import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { existsSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { getVideoDuration } from './ffmpeg/ffmpeg'
import {
  computeSplitPoints,
  detectSilencePoints,
  detectSceneChanges,
  computeSilenceBasedSplitPoints,
  computeSceneBasedSplitPoints,
  splitVideo,
  type SplitSettings,
  type SplitPoint
} from './ffmpeg/split'
import { extractAudio, transcribeAudio, type TranscribeOptions } from './whisper/transcribe'
import { type WhisperModelSize, getAvailableModels, WHISPER_MODEL_SIZES } from './whisper/whisper'
import { burnCaptions, type CaptionJob } from './ffmpeg/caption'
import { type CaptionStyle } from './ffmpeg/filters'
import { checkOllamaRunning, listOllamaModels, generateText } from './llm/ollama'
import {
  buildCleanTranscriptPrompt,
  buildHighlightDetectionPrompt,
  buildTitleGenerationPrompt,
  parseJsonResponse,
  type CleanTranscriptOptions
} from './llm/prompts'
import { ProgressReporter } from './utils/progress'
import { AppError, ErrorCodes } from './utils/errors'

export function registerIpcHandlers (mainWindow: BrowserWindow): void {
  const progress = new ProgressReporter(mainWindow)

  ipcMain.handle('select-video', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    if (!existsSync(filePath)) {
      throw new AppError('File does not exist', ErrorCodes.VIDEO_FILE_NOT_FOUND)
    }

    const stats = statSync(filePath)
    const duration = await getVideoDuration(filePath)

    return {
      path: filePath,
      name: filePath.split('/').pop() || filePath.split('\\').pop() || '',
      size: stats.size,
      duration
    }
  })

  ipcMain.handle('select-output-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('get-video-duration', async (_event, filePath: string) => {
    return getVideoDuration(filePath)
  })

  ipcMain.handle('compute-split-points', async (_event, {
    duration,
    settings
  }: {
    duration: number
    settings: SplitSettings
  }) => {
    return computeSplitPoints(duration, settings)
  })

  ipcMain.handle('detect-silence-points', async (_event, {
    inputPath,
    silenceDuration,
    silenceThreshold
  }: {
    inputPath: string
    silenceDuration?: number
    silenceThreshold?: string
  }) => {
    return detectSilencePoints(inputPath, silenceDuration, silenceThreshold)
  })

  ipcMain.handle('detect-scene-changes', async (_event, {
    inputPath,
    threshold
  }: {
    inputPath: string
    threshold?: number
  }) => {
    return detectSceneChanges(inputPath, threshold)
  })

  ipcMain.handle('compute-silence-split-points', async (_event, {
    duration,
    timestamps,
    minClipDuration,
    maxClipDuration
  }: {
    duration: number
    timestamps: number[]
    minClipDuration?: number
    maxClipDuration?: number
  }) => {
    return computeSilenceBasedSplitPoints(duration, timestamps, minClipDuration, maxClipDuration)
  })

  ipcMain.handle('compute-scene-split-points', async (_event, {
    duration,
    timestamps,
    minClipDuration,
    maxClipDuration
  }: {
    duration: number
    timestamps: number[]
    minClipDuration?: number
    maxClipDuration?: number
  }) => {
    return computeSceneBasedSplitPoints(duration, timestamps, minClipDuration, maxClipDuration)
  })

  ipcMain.handle('split-video', async (event, {
    inputPath,
    outputDir,
    splitPoints
  }: {
    inputPath: string
    outputDir: string
    splitPoints: SplitPoint[]
  }) => {
    const abortController = new AbortController()
    const channelId = `split-${Date.now()}`

    const handler = (_e: Electron.IpcMainEvent, cancelChannel: string) => {
      if (cancelChannel === channelId) {
        abortController.abort()
      }
    }
    ipcMain.on('cancel-operation', handler)

    try {
      const clipPaths = await splitVideo(
        inputPath,
        outputDir,
        splitPoints,
        (current, total) => {
          mainWindow.webContents.send('split-progress', { current, total })
        },
        abortController.signal
      )
      return clipPaths
    } finally {
      ipcMain.removeListener('cancel-operation', handler)
    }
  })

  ipcMain.handle('extract-audio', async (_event, {
    videoPath,
    outputPath
  }: {
    videoPath: string
    outputPath: string
  }) => {
    const signal = new AbortController().signal
    await extractAudio(videoPath, outputPath, signal)
    return outputPath
  })

  ipcMain.handle('transcribe', async (event, options: TranscribeOptions & { audioPath: string }) => {
    const { audioPath, ...transcribeOpts } = options
    return transcribeAudio(audioPath, transcribeOpts)
  })

  ipcMain.handle('burn-captions', async (event, job: CaptionJob) => {
    const abortController = new AbortController()
    const channelId = `captions-${Date.now()}`
    const handler = (_e: Electron.IpcMainEvent, cancelChannel: string) => {
      if (cancelChannel === channelId) {
        abortController.abort()
      }
    }

    ipcMain.on('cancel-operation', handler)

    try {
      const outputPath = await burnCaptions(
        job,
        (percent) => {
          mainWindow.webContents.send('caption-progress', { percent })
        },
        abortController.signal
      )
      return outputPath
    } finally {
      ipcMain.removeListener('cancel-operation', handler)
    }
  })

  ipcMain.handle('get-available-models', async () => {
    return getAvailableModels()
  })

  ipcMain.handle('get-model-sizes', async () => {
    return WHISPER_MODEL_SIZES
  })

  ipcMain.handle('get-app-paths', async () => {
    return {
      userData: app.getPath('userData'),
      home: app.getPath('home'),
      downloads: app.getPath('downloads'),
      desktop: app.getPath('desktop'),
      documents: app.getPath('documents')
    }
  })

  ipcMain.handle('check-ollama', async () => {
    const running = await checkOllamaRunning()
    if (!running) {
      return { running: false, models: [] }
    }
    const models = await listOllamaModels()
    return { running, models }
  })

  ipcMain.handle('ollama-generate', async (_event, {
    model,
    prompt,
    system,
    temperature,
    maxTokens
  }: {
    model: string
    prompt: string
    system?: string
    temperature?: number
    maxTokens?: number
  }) => {
    return generateText({ model, prompt, system, temperature, maxTokens })
  })

  ipcMain.handle('llm-clean-transcript', async (_event, {
    transcript,
    options
  }: {
    transcript: string
    options: CleanTranscriptOptions
  }) => {
    const prompt = buildCleanTranscriptPrompt({ transcript, ...options })
    return generateText({
      model: 'llama3.2',
      prompt,
      system: 'You are a transcript cleaning assistant. Return only the cleaned text.',
      temperature: 0.3
    })
  })

  ipcMain.handle('llm-detect-highlights', async (_event, {
    transcript,
    duration,
    numberOfHighlights
  }: {
    transcript: string
    duration: number
    numberOfHighlights?: number
  }) => {
    const prompt = buildHighlightDetectionPrompt({
      transcript,
      duration,
      numberOfHighlights
    })

    const response = await generateText({
      model: 'llama3.2',
      prompt,
      system: 'You are a video highlight detection assistant. Return only JSON.',
      temperature: 0.5
    })

    return parseJsonResponse<Array<{ startTime: number; endTime: number; reason: string }>>(response) || []
  })

  ipcMain.handle('llm-generate-titles', async (_event, {
    transcript,
    context
  }: {
    transcript: string
    context?: string
  }) => {
    const prompt = buildTitleGenerationPrompt({ transcript, context })

    const response = await generateText({
      model: 'llama3.2',
      prompt,
      system: 'You are a social media title generation assistant. Return only JSON.',
      temperature: 0.7
    })

    return parseJsonResponse<Array<{ title: string; hook: string }>>(response) || []
  })
}
