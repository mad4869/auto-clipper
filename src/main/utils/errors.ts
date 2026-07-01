export class AppError extends Error {
  public code: string
  public recoverable: boolean

  constructor (message: string, code: string, recoverable = false) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.recoverable = recoverable
  }
}

export const ErrorCodes = {
  FFMPEG_NOT_FOUND: 'FFMPEG_NOT_FOUND',
  WHISPER_NOT_FOUND: 'WHISPER_NOT_FOUND',
  WHISPER_MODEL_NOT_FOUND: 'WHISPER_MODEL_NOT_FOUND',
  OLLAMA_NOT_RUNNING: 'OLLAMA_NOT_RUNNING',
  OLLAMA_MODEL_NOT_FOUND: 'OLLAMA_MODEL_NOT_FOUND',
  VIDEO_FILE_NOT_FOUND: 'VIDEO_FILE_NOT_FOUND',
  VIDEO_FILE_INVALID: 'VIDEO_FILE_INVALID',
  SPLIT_FAILED: 'SPLIT_FAILED',
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  CAPTION_BURN_FAILED: 'CAPTION_BURN_FAILED',
  OUTPUT_DIR_NOT_FOUND: 'OUTPUT_DIR_NOT_FOUND',
  DISK_FULL: 'DISK_FULL',
  UNKNOWN: 'UNKNOWN'
} as const

export function createError (message: string, code?: string, recoverable?: boolean): AppError {
  return new AppError(message, code ?? ErrorCodes.UNKNOWN, recoverable ?? true)
}
