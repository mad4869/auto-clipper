import { BrowserWindow } from 'electron'

export type ProgressEvent =
  | { type: 'stage'; stage: string }
  | { type: 'progress'; percent: number; detail: string }
  | { type: 'error'; message: string; code: string }
  | { type: 'done'; result: unknown }

export class ProgressReporter {
  private window: BrowserWindow | null

  constructor (window: BrowserWindow | null) {
    this.window = window
  }

  send (event: ProgressEvent): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('progress', event)
    }
  }

  stage (stage: string): void {
    this.send({ type: 'stage', stage })
  }

  progress (percent: number, detail: string): void {
    this.send({ type: 'progress', percent, detail })
  }

  done (result: unknown): void {
    this.send({ type: 'done', result })
  }

  error (message: string, code: string): void {
    this.send({ type: 'error', message, code })
  }
}
