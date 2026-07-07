import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { existsSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
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
import { type CaptionStyle, type WordTiming } from './ffmpeg/filters'
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

function postProcessLlmTranscript (text: string): string {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
  cleaned = cleaned.replace(/^(?:sure[!,\s]*|certainly[!,\s]*|of course[!,\s]*)*(?:here is|here's|below is|this is)?\s*(?:the\s*)?(?:cleaned|corrected|edited|revised|final)?\s*(?:and\s*)?(?:cleaned|corrected|edited|revised|final)?\s*(?:video\s*)?(?:transcript|version|output|text|result)?\s*:\s*/i, '').trim()

  const firstWords = cleaned.slice(0, 50).trim()
  if (firstWords.length >= 25 && cleaned.length > 200) {
    const secondIdx = cleaned.indexOf(firstWords, 100)
    if (secondIdx > 0) {
      cleaned = cleaned.slice(0, secondIdx).trim()
    }
  }

  const midRegex = /\n+(?:here is|here's|below is|this is)\s*(?:the\s*)?(?:cleaned|corrected|edited|revised|final)?\s*(?:and\s*)?(?:cleaned|corrected|edited|revised|final)?\s*(?:video\s*)?(?:transcript|version|output|text|result)?\s*:\s*/i
  const midMatch = cleaned.match(midRegex)
  if (midMatch && midMatch.index !== undefined && midMatch.index > 50) {
    cleaned = cleaned.slice(0, midMatch.index).trim()
  }

  return cleaned
}

function alignWords (orig: WordTiming[], cleanedText: string): WordTiming[] {
  const cleanWords = cleanedText.trim().split(/\s+/).filter(Boolean)
  if (cleanWords.length === 0 || orig.length === 0) return orig

  const n = orig.length
  const m = cleanWords.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity))
  dp[0][0] = 0

  for (let i = 1; i <= n; i++) dp[i][0] = i * 0.6
  for (let j = 1; j <= m; j++) dp[0][j] = j * 0.6

  for (let i = 1; i <= n; i++) {
    const w1 = orig[i - 1].word.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF]/g, '')
    for (let j = 1; j <= m; j++) {
      const w2 = cleanWords[j - 1].toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF]/g, '')
      let matchCost = 1.0
      if (w1 === w2 && w1.length > 0) {
        matchCost = 0
      } else if (w1.length > 0 && w2.length > 0) {
        if (w1.includes(w2) || w2.includes(w1)) matchCost = 0.2
        else if (w1[0] === w2[0] && Math.abs(w1.length - w2.length) <= 2) matchCost = 0.4
      }
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + matchCost,
        dp[i - 1][j] + 0.6,
        dp[i][j - 1] + 0.6
      )
    }
  }

  let i = n
  let j = m
  const aligned: Array<{ word: string; start: number; end: number }> = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const w1 = orig[i - 1].word.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF]/g, '')
      const w2 = cleanWords[j - 1].toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF]/g, '')
      let matchCost = 1.0
      if (w1 === w2 && w1.length > 0) matchCost = 0
      else if (w1.length > 0 && w2.length > 0 && (w1.includes(w2) || w2.includes(w1))) matchCost = 0.2
      else if (w1[0] === w2[0] && Math.abs(w1.length - w2.length) <= 2) matchCost = 0.4

      if (Math.abs(dp[i][j] - (dp[i - 1][j - 1] + matchCost)) < 1e-6) {
        aligned.unshift({
          word: cleanWords[j - 1],
          start: orig[i - 1].start,
          end: orig[i - 1].end
        })
        i--
        j--
        continue
      }
    }
    if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + 0.6)) < 1e-6) {
      i--
      continue
    }
    if (j > 0) {
      aligned.unshift({
        word: cleanWords[j - 1],
        start: -1,
        end: -1
      })
      j--
    }
  }

  for (let k = 0; k < aligned.length; k++) {
    if (aligned[k].start === -1) {
      const prevEnd = k > 0 ? aligned[k - 1].end : 0
      let nextStart = prevEnd + 0.5
      for (let next = k + 1; next < aligned.length; next++) {
        if (aligned[next].start !== -1) {
          nextStart = aligned[next].start
          break
        }
      }
      aligned[k].start = prevEnd
      aligned[k].end = Math.max(prevEnd + 0.1, Math.min(nextStart, prevEnd + 0.3))
    }
  }

  return aligned
}

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

    const name = basename(filePath) || 'video'
    const ext = name.includes('.') ? `.${name.split('.').pop()}` : ''
    const baseName = ext ? name.slice(0, -ext.length) : name
    const defaultOutputDir = join(dirname(filePath), `${baseName}_clips`)

    return {
      path: filePath,
      name,
      size: stats.size,
      duration,
      defaultOutputDir
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

async function resolveOllamaModel (requested?: string): Promise<string> {
  const models = await listOllamaModels()
  if (requested && models.find(m => m.name === requested)) {
    return requested
  }
  if (models.length > 0) {
    return models[0].name
  }
  return requested || 'llama3.2'
}

  ipcMain.handle('llm-clean-transcript', async (_event, {
    transcript,
    words,
    options,
    model
  }: {
    transcript: string
    words?: WordTiming[]
    options: CleanTranscriptOptions
    model?: string
  }) => {
    const activeModel = await resolveOllamaModel(model)
    const prompt = buildCleanTranscriptPrompt({ transcript, ...options })
    const rawCleanedText = await generateText({
      model: activeModel,
      prompt,
      system: 'You are an expert transcript editor and speech-to-text error corrector. Return only the cleaned and corrected text without markdown or commentary.',
      temperature: 0.2,
      maxTokens: 4096
    })
    const cleanedText = postProcessLlmTranscript(rawCleanedText)

    if (words && Array.isArray(words) && words.length > 0) {
      const alignedWords = alignWords(words, cleanedText)
      return { text: cleanedText, words: alignedWords }
    }
    return { text: cleanedText }
  })

  ipcMain.handle('llm-detect-highlights', async (_event, {
    transcript,
    duration,
    numberOfHighlights,
    model
  }: {
    transcript: string
    duration: number
    numberOfHighlights?: number
    model?: string
  }) => {
    const activeModel = await resolveOllamaModel(model)
    const prompt = buildHighlightDetectionPrompt({
      transcript,
      duration,
      numberOfHighlights
    })

    const response = await generateText({
      model: activeModel,
      prompt,
      system: 'You are a video highlight detection assistant. Return only JSON.',
      temperature: 0.5
    })

    return parseJsonResponse<Array<{ startTime: number; endTime: number; reason: string }>>(response) || []
  })

  ipcMain.handle('llm-generate-titles', async (_event, {
    transcript,
    context,
    model
  }: {
    transcript: string
    context?: string
    model?: string
  }) => {
    const activeModel = await resolveOllamaModel(model)
    const prompt = buildTitleGenerationPrompt({ transcript, context })

    const response = await generateText({
      model: activeModel,
      prompt,
      system: 'You are a social media title generation assistant. Return only JSON.',
      temperature: 0.7
    })

    return parseJsonResponse<Array<{ title: string; hook: string }>>(response) || []
  })
}
