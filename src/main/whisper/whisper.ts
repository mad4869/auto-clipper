import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { AppError, ErrorCodes } from '../utils/errors'
import { resolveResourcesDir } from '../utils/paths'

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large'

export const WHISPER_MODEL_SIZES: Record<WhisperModelSize, { name: string, sizeMB: number, description: string }> = {
  tiny: { name: 'tiny', sizeMB: 75, description: 'Fastest, least accurate (~75MB)' },
  base: { name: 'base', sizeMB: 142, description: 'Fast, reasonable accuracy (~142MB)' },
  small: { name: 'small', sizeMB: 466, description: 'Good accuracy/speed balance (~466MB)' },
  medium: { name: 'medium', sizeMB: 1533, description: 'High accuracy, slower (~1.5GB)' },
  large: { name: 'large', sizeMB: 3090, description: 'Best accuracy, slowest (~3GB)' }
}

let cachedWhisperPath: string | null = null
let cachedModelsDir: string | null = null

export function resolveWhisperPath (): string {
  if (cachedWhisperPath) return cachedWhisperPath

  const ext = process.platform === 'win32' ? '.exe' : ''
  const resourcesDir = resolveResourcesDir()

  // Check bundled/local resources first (works in both dev and packaged modes)
  // The canonical name is whisper-cli; `main` is the legacy build output name
  const bundledCandidates = [
    join(resourcesDir, 'whisper', `whisper-cli${ext}`),
    join(resourcesDir, 'whisper', `main${ext}`)
  ]

  for (const candidate of bundledCandidates) {
    if (existsSync(candidate)) {
      cachedWhisperPath = candidate
      return candidate
    }
  }

  // Fall back to system PATH
  cachedWhisperPath = 'whisper-cli'
  return 'whisper-cli'
}

export function resolveModelsDir (): string {
  if (cachedModelsDir) return cachedModelsDir

  // Check bundled/local resources first (works in both dev and packaged modes)
  const bundledModels = join(resolveResourcesDir(), 'whisper', 'models')
  if (existsSync(bundledModels)) {
    cachedModelsDir = bundledModels
    return bundledModels
  }

  // Check user data directory (cross-platform app data)
  //   macOS:   ~/Library/Application Support/video-clipper/whisper-models/
  //   Windows: %APPDATA%\video-clipper\whisper-models\
  //   Linux:   ~/.config/video-clipper/whisper-models/
  const userDataPath = app.getPath('userData')
  const userModels = join(userDataPath, 'whisper-models')
  if (existsSync(userModels)) {
    cachedModelsDir = userModels
    return userModels
  }

  // Default: create the user data directory on first use
  const { mkdirSync } = require('node:fs')
  mkdirSync(userModels, { recursive: true })
  cachedModelsDir = userModels
  return userModels
}

export function findModelPath (modelSize: WhisperModelSize): string {
  const modelsDir = resolveModelsDir()
  const modelName = `ggml-${modelSize}.bin`
  const modelPath = join(modelsDir, modelName)

  if (existsSync(modelPath)) {
    return modelPath
  }

  const files = readdirSync(modelsDir)
  const match = files.find(f =>
    f.includes(modelSize) && f.endsWith('.bin')
  )

  if (match) {
    return join(modelsDir, match)
  }

  const available = files.filter(f => f.endsWith('.bin'))

  throw new AppError(
    `Whisper model '${modelName}' not found in ${modelsDir}. ` +
    `Available models: ${available.length > 0 ? available.join(', ') : 'none'}. ` +
    `Download from: https://huggingface.co/ggerganov/whisper.cpp/tree/main`,
    ErrorCodes.WHISPER_MODEL_NOT_FOUND,
    true
  )
}

export function getAvailableModels (): { size: WhisperModelSize; path: string }[] {
  try {
    const modelsDir = resolveModelsDir()
    const files = readdirSync(modelsDir)
    const available: { size: WhisperModelSize; path: string }[] = []

    for (const size of Object.keys(WHISPER_MODEL_SIZES) as WhisperModelSize[]) {
      const modelName = `ggml-${size}.bin`
      const modelPath = join(modelsDir, modelName)
      if (existsSync(modelPath)) {
        available.push({ size, path: modelPath })
      } else {
        const match = files.find(f => f.includes(size) && f.endsWith('.bin'))
        if (match) {
          available.push({ size, path: join(modelsDir, match) })
        }
      }
    }

    return available
  } catch {
    return []
  }
}
