import { execFile } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import { resolveWhisperPath, findModelPath, type WhisperModelSize, WHISPER_MODEL_SIZES } from './whisper'
import { type WordTiming } from '../ffmpeg/filters'
import { AppError, ErrorCodes } from '../utils/errors'
import { runFfmpeg } from '../ffmpeg/ffmpeg'

export interface TranscriptionResult {
  text: string
  words: WordTiming[]
  language: string
  duration: number
}

export interface TranscribeOptions {
  modelSize: WhisperModelSize
  language?: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export function parseWhisperOutput (output: string): { text: string; words: WordTiming[] } {
  const lines = output.split('\n').filter(l => l.trim())
  const words: WordTiming[] = []
  const textParts: string[] = []

  for (const line of lines) {
    const match = line.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)$/)
    if (match) {
      const start = parseTimestamp(match[1])
      const end = parseTimestamp(match[2])
      const word = match[3].trim()
      words.push({ word, start, end })
      textParts.push(word)
    }
  }

  return {
    text: textParts.join(' '),
    words
  }
}

function parseTimestamp (ts: string): number {
  const parts = ts.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  const secParts = parts[2].split('.')
  const seconds = parseInt(secParts[0], 10)
  const millis = parseInt(secParts[1], 10)
  return hours * 3600 + minutes * 60 + seconds + millis / 1000
}

export async function transcribeAudio (
  audioPath: string,
  options: TranscribeOptions
): Promise<TranscriptionResult> {
  const whisperPath = resolveWhisperPath()
  const modelPath = findModelPath(options.modelSize)

  const args: string[] = [
    '-m', modelPath,
    '-f', audioPath,
    '-t', '4', // use 4 threads
    '-l', options.language || 'auto',
    '-oj', // output as JSON
    '-ojf' // output full JSON including tokens
  ]

  return new Promise((resolve, reject) => {
    const proc = execFile(
      whisperPath,
      args,
      { maxBuffer: 1024 * 1024 * 50 },
      async (error, stdout, stderr) => {
        const jsonPath = `${audioPath}.json`

        try {
          const jsonContent = await readFile(jsonPath, 'utf8')
          const parsed = JSON.parse(jsonContent)

          const words: WordTiming[] = []
          const textSegments: string[] = []

          if (Array.isArray(parsed.transcription)) {
            for (const seg of parsed.transcription) {
              if (seg.text) textSegments.push(seg.text.trim())
              if (Array.isArray(seg.tokens) && seg.tokens.length > 0) {
                for (const tok of seg.tokens) {
                  const tokText = (tok.text || '').trim()
                  if (!tokText || tokText.startsWith('[') && tokText.endsWith(']')) continue
                  words.push({
                    word: tokText,
                    start: (tok.offsets?.from || 0) / 1000,
                    end: (tok.offsets?.to || 0) / 1000
                  })
                }
              } else if (seg.text) {
                words.push({
                  word: seg.text.trim(),
                  start: (seg.offsets?.from || 0) / 1000,
                  end: (seg.offsets?.to || 0) / 1000
                })
              }
            }
          } else if (parsed.transcription) {
            if (parsed.transcription.text) textSegments.push(parsed.transcription.text)
            if (Array.isArray(parsed.transcription.segments)) {
              for (const seg of parsed.transcription.segments) {
                if (Array.isArray(seg.words)) {
                  for (const w of seg.words) {
                    words.push({
                      word: w.text || w.word || '',
                      start: w.start || 0,
                      end: w.end || 0
                    })
                  }
                }
              }
            }
          }

          const fullText = textSegments.join(' ')
          await unlink(jsonPath).catch(() => {})

          if (words.length > 0) {
            resolve({
              text: fullText,
              words,
              language: parsed.result?.language || options.language || 'en',
              duration: words[words.length - 1].end
            })
            return
          }
        } catch {
          await unlink(jsonPath).catch(() => {})
        }

        if (error && !stdout) {
          reject(new AppError(
            `Transcription failed: ${stderr || error?.message}`,
            ErrorCodes.TRANSCRIPTION_FAILED,
            true
          ))
          return
        }

        const parsedOutput = parseWhisperOutput(stdout || stderr || '')
        resolve({
          text: parsedOutput.text,
          words: parsedOutput.words,
          language: options.language || 'en',
          duration: parsedOutput.words.length > 0
            ? parsedOutput.words[parsedOutput.words.length - 1].end
            : 0
        })
      }
    )

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        proc.kill('SIGTERM')
      })
    }

    if (options.onProgress) {
      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString()
        const match = line.match(/(\d+)%/)
        if (match) {
          options.onProgress!(parseInt(match[1], 10))
        }
      })
    }
  })
}

export async function extractAudio (
  videoPath: string,
  outputPath: string,
  signal?: AbortSignal
): Promise<void> {
  await runFfmpeg(
    [
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y',
      outputPath
    ],
    { signal }
  )
}
