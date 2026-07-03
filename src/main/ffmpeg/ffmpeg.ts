import { execFile, type ExecFileOptions } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { AppError, ErrorCodes } from '../utils/errors'
import { resolveResourcesDir } from '../utils/paths'

let cachedPath: string | null = null

export function resolveFfmpegPath (): string {
  if (cachedPath) return cachedPath

  const ext = process.platform === 'win32' ? '.exe' : ''

  // Check bundled/local resources first (works in both dev and packaged modes)
  const bundled = join(resolveResourcesDir(), 'ffmpeg', `ffmpeg${ext}`)
  if (existsSync(bundled)) {
    cachedPath = bundled
    return bundled
  }

  // Fall back to system PATH
  cachedPath = 'ffmpeg'
  return 'ffmpeg'
}

export interface FfmpegProgress {
  durationSeconds: number
  currentTime: number
  percent: number
}

export type ProgressCallback = (progress: FfmpegProgress) => void

function parseFfmpegProgress (line: string, durationSeconds: number): FfmpegProgress | null {
  const match = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
  if (!match) return null

  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const seconds = parseInt(match[3], 10)
  const centiseconds = parseInt(match[4], 10)
  const currentTime = hours * 3600 + minutes * 60 + seconds + centiseconds / 100
  const percent = durationSeconds > 0 ? Math.min(100, (currentTime / durationSeconds) * 100) : 0

  return { durationSeconds, currentTime, percent }
}

export function runFfmpeg (
  args: string[],
  options: {
    durationSeconds?: number
    onProgress?: ProgressCallback
    signal?: AbortSignal
  } = {}
): Promise<void> {
  const ffmpegPath = resolveFfmpegPath()

  return new Promise((resolve, reject) => {
    const opts: ExecFileOptions = { maxBuffer: 1024 * 1024 * 10 }

    const proc = execFile(ffmpegPath, args, opts, (error, _stdout, stderr) => {
      if (error) {
        if ((error as NodeJS.ErrnoException).code === 'ABORT_ERR') {
          reject(new AppError('Operation cancelled', 'CANCELLED', true))
        } else {
          reject(new AppError(
            `FFmpeg failed: ${stderr || error.message}`,
            ErrorCodes.UNKNOWN,
            true
          ))
        }
        return
      }
      resolve()
    })

    if (options.signal) {
      const abortHandler = () => proc.kill('SIGTERM')
      options.signal.addEventListener('abort', abortHandler, { once: true })
      proc.on('close', () => options.signal!.removeEventListener('abort', abortHandler))
    }

    if (options.onProgress && options.durationSeconds) {
      proc.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          const progress = parseFfmpegProgress(line, options.durationSeconds!)
          if (progress) {
            options.onProgress!(progress)
          }
        }
      })
    }
  })
}

export function getVideoDuration (filePath: string): Promise<number> {
  const ffmpegPath = resolveFfmpegPath()

  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      ['-i', filePath, '-f', 'null', '-'],
      { maxBuffer: 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
          if (match) {
            const hours = parseInt(match[1], 10)
            const minutes = parseInt(match[2], 10)
            const seconds = parseInt(match[3], 10)
            const hundredths = parseInt(match[4], 10)
            resolve(hours * 3600 + minutes * 60 + seconds + hundredths / 100)
          } else {
            reject(new AppError(
              `Could not determine video duration: ${stderr}`,
              ErrorCodes.VIDEO_FILE_INVALID,
              true
            ))
          }
        } else {
          const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
          if (match) {
            const hours = parseInt(match[1], 10)
            const minutes = parseInt(match[2], 10)
            const seconds = parseInt(match[3], 10)
            const hundredths = parseInt(match[4], 10)
            resolve(hours * 3600 + minutes * 60 + seconds + hundredths / 100)
          } else {
            resolve(0)
          }
        }
      }
    )
  })
}
