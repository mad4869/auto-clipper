import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { AppError, ErrorCodes } from '../utils/errors'

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

  const candidates: string[] = []

  if (app.isPackaged) {
    const resourcePath = process.resourcesPath
    const platform = process.platform
    const ext = platform === 'win32' ? '.exe' : ''
    candidates.push(join(resourcePath, 'whisper', `whisper-cli${ext}`))
    candidates.push(join(resourcePath, 'whisper', `whisper.cpp${ext}`))
    candidates.push(join(resourcePath, 'whisper', `main${ext}`))
  }

  candidates.push('whisper-cli')
  candidates.push('whisper.cpp')
  candidates.push('whisper-cpp')

  for (const candidate of candidates) {
    if (candidate === 'whisper-cli' || candidate === 'whisper.cpp' || candidate === 'whisper-cpp') {
      cachedWhisperPath = candidate
      return candidate
    }
    if (existsSync(candidate)) {
      cachedWhisperPath = candidate
      return candidate
    }
  }

  throw new AppError(
    'Whisper CLI not found. Build whisper.cpp and place the binary in resources/whisper/.',
    ErrorCodes.WHISPER_NOT_FOUND,
    true
  )
}

export function resolveModelsDir (): string {
  if (cachedModelsDir) return cachedModelsDir

  const candidates: string[] = []

  if (app.isPackaged) {
    const resourcePath = process.resourcesPath
    candidates.push(join(resourcePath, 'whisper', 'models'))
  }

  const userDataPath = app.getPath('userData')
  candidates.push(join(userDataPath, 'whisper-models'))

  candidates.push('models')
  candidates.push('./models')

  for (const dir of candidates) {
    if (existsSync(dir)) {
      cachedModelsDir = dir
      return dir
    }
  }

  const defaultDir = join(userDataPath, 'whisper-models')
  const { mkdirSync } = require('node:fs')
  mkdirSync(defaultDir, { recursive: true })
  cachedModelsDir = defaultDir
  return defaultDir
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
