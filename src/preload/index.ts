import { contextBridge, ipcRenderer } from 'electron'

const api = {
  selectVideo: () => ipcRenderer.invoke('select-video'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  getVideoDuration: (filePath: string) => ipcRenderer.invoke('get-video-duration', filePath),
  computeSplitPoints: (params: { duration: number; settings: Record<string, unknown> }) =>
    ipcRenderer.invoke('compute-split-points', params),
  detectSilencePoints: (params: { inputPath: string; silenceDuration?: number; silenceThreshold?: string }) =>
    ipcRenderer.invoke('detect-silence-points', params),
  detectSceneChanges: (params: { inputPath: string; threshold?: number }) =>
    ipcRenderer.invoke('detect-scene-changes', params),
  computeSilenceSplitPoints: (params: { duration: number; timestamps: number[]; minClipDuration?: number; maxClipDuration?: number }) =>
    ipcRenderer.invoke('compute-silence-split-points', params),
  computeSceneSplitPoints: (params: { duration: number; timestamps: number[]; minClipDuration?: number; maxClipDuration?: number }) =>
    ipcRenderer.invoke('compute-scene-split-points', params),
  splitVideo: (params: { inputPath: string; outputDir: string; splitPoints: Array<{ start: number; end: number; index: number }> }) =>
    ipcRenderer.invoke('split-video', params),
  extractAudio: (params: { videoPath: string; outputPath: string }) =>
    ipcRenderer.invoke('extract-audio', params),
  transcribe: (params: { audioPath: string; modelSize: string; language?: string }) =>
    ipcRenderer.invoke('transcribe', params),
  burnCaptions: (params: Record<string, unknown>) =>
    ipcRenderer.invoke('burn-captions', params),
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  getModelSizes: () => ipcRenderer.invoke('get-model-sizes'),
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  checkOllama: () => ipcRenderer.invoke('check-ollama'),
  ollamaGenerate: (params: { model: string; prompt: string; system?: string; temperature?: number; maxTokens?: number }) =>
    ipcRenderer.invoke('ollama-generate', params),
  llmCleanTranscript: (params: { transcript: string; words?: unknown[]; options: Record<string, unknown>; model?: string }) =>
    ipcRenderer.invoke('llm-clean-transcript', params),
  llmDetectHighlights: (params: { transcript: string; duration: number; numberOfHighlights?: number; model?: string }) =>
    ipcRenderer.invoke('llm-detect-highlights', params),
  llmGenerateTitles: (params: { transcript: string; context?: string; model?: string }) =>
    ipcRenderer.invoke('llm-generate-titles', params),
  cancelOperation: (channelId: string) => ipcRenderer.send('cancel-operation', channelId),
  onProgress: (callback: (event: unknown) => void) => {
    ipcRenderer.on('progress', (_event, data) => callback(data))
  },
  onSplitProgress: (callback: (data: { current: number; total: number }) => void) => {
    ipcRenderer.on('split-progress', (_event, data) => callback(data))
  },
  onCaptionProgress: (callback: (data: { percent: number }) => void) => {
    ipcRenderer.on('caption-progress', (_event, data) => callback(data))
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
