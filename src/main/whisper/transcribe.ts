import { execFile } from 'node:child_process'
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
    '-ot', // output timings (word-level timestamps)
    '-t', '4', // use 4 threads
    '-l', options.language || 'auto',
    '--no-timestamps',
    '-oj', // output as JSON
    '--max-len', '1' // one word per line for word timestamps
  ]

  return new Promise((resolve, reject) => {
    const proc = execFile(
      whisperPath,
      args,
      { maxBuffer: 1024 * 1024 * 50 },
      (error, stdout, stderr) => {
        if (error && !stdout) {
          reject(new AppError(
            `Transcription failed: ${stderr || error.message}`,
            ErrorCodes.TRANSCRIPTION_FAILED,
            true
          ))
          return
        }

        try {
          const jsonOutput = stdout.trim()
          const parsed = JSON.parse(jsonOutput)

          const words: WordTiming[] = []
          let text = ''

          if (parsed.transcription) {
            text = parsed.transcription.text || ''
            if (parsed.transcription.segments) {
              for (const seg of parsed.transcription.segments) {
                if (seg.words) {
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

          if (words.length === 0) {
            const parsed2 = parseWhisperOutput(stdout || stderr)
            resolve({
              text: parsed2.text,
              words: parsed2.words,
              language: options.language || 'en',
              duration: parsed2.words.length > 0
                ? parsed2.words[parsed2.words.length - 1].end
                : 0
            })
          } else {
            resolve({
              text,
              words,
              language: parsed.transcription?.language || options.language || 'en',
              duration: words.length > 0 ? words[words.length - 1].end : 0
            })
          }
        } catch {
          const parsed = parseWhisperOutput(stdout || stderr)
          resolve({
            text: parsed.text,
            words: parsed.words,
            language: options.language || 'en',
            duration: parsed.words.length > 0
              ? parsed.words[parsed.words.length - 1].end
              : 0
          })
        }
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
