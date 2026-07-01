import { create } from 'zustand'

export interface VideoInfo {
  path: string
  name: string
  size: number
  duration: number
}

export interface SplitPoint {
  start: number
  end: number
  index: number
}

export interface WordTiming {
  word: string
  start: number
  end: number
}

export type SplitMode = 'fixed-duration' | 'fixed-count' | 'silence' | 'scene'

export interface SplitSettings {
  mode: SplitMode
  duration?: number
  count?: number
  silenceDuration?: number
  silenceThreshold?: string
  sceneThreshold?: number
  minClipDuration?: number
  maxClipDuration?: number
}

export type CaptionPosition = 'lower-third' | 'center' | 'top'
export type CaptionAnimation = 'pop' | 'karaoke' | 'fade'

export interface CaptionStyle {
  font: string
  fontSize: number
  fontColor: string
  highlightColor: string
  position: CaptionPosition
  animation: CaptionAnimation
  maxWordsPerLine: number
  showEmojiHighlight: boolean
}

export type AppStage = 'import' | 'split-settings' | 'preview' | 'caption-settings' | 'exporting' | 'done'

export interface OllamaStatus {
  running: boolean
  models: Array<{ name: string; modifiedAt: string; size: number }>
}

export interface AppState {
  stage: AppStage
  video: VideoInfo | null
  outputDir: string | null
  splitSettings: SplitSettings
  splitPoints: SplitPoint[]
  captionStyle: CaptionStyle
  transcription: { text: string; words: WordTiming[]; language: string } | null
  whisperModelSize: string
  availableModels: Array<{ size: string; path: string }>
  ollama: OllamaStatus | null
  processing: boolean
  progress: { stage: string; percent: number; detail: string } | null
  clipPaths: string[]
  error: string | null

  setStage: (stage: AppStage) => void
  setVideo: (video: VideoInfo | null) => void
  setOutputDir: (dir: string | null) => void
  setSplitSettings: (settings: Partial<SplitSettings>) => void
  setSplitPoints: (points: SplitPoint[]) => void
  setCaptionStyle: (style: Partial<CaptionStyle>) => void
  setTranscription: (t: { text: string; words: WordTiming[]; language: string } | null) => void
  setWhisperModelSize: (size: string) => void
  setAvailableModels: (models: Array<{ size: string; path: string }>) => void
  setOllama: (status: OllamaStatus | null) => void
  setProcessing: (p: boolean) => void
  setProgress: (p: { stage: string; percent: number; detail: string } | null) => void
  setClipPaths: (paths: string[]) => void
  setError: (err: string | null) => void
  reset: () => void
}

const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  font: 'Arial',
  fontSize: 28,
  fontColor: '#FFFFFF',
  highlightColor: '#FFD700',
  position: 'lower-third',
  animation: 'pop',
  maxWordsPerLine: 4,
  showEmojiHighlight: false
}

const DEFAULT_SPLIT_SETTINGS: SplitSettings = {
  mode: 'fixed-duration',
  duration: 60,
  count: 5,
  silenceDuration: 0.5,
  silenceThreshold: '-30dB',
  sceneThreshold: 0.3,
  minClipDuration: 10,
  maxClipDuration: 120
}

export const useStore = create<AppState>((set) => ({
  stage: 'import',
  video: null,
  outputDir: null,
  splitSettings: DEFAULT_SPLIT_SETTINGS,
  splitPoints: [],
  captionStyle: DEFAULT_CAPTION_STYLE,
  transcription: null,
  whisperModelSize: 'small',
  availableModels: [],
  ollama: null,
  processing: false,
  progress: null,
  clipPaths: [],
  error: null,

  setStage: (stage) => set({ stage }),
  setVideo: (video) => set({ video, stage: video ? 'split-settings' : 'import', splitPoints: [], transcription: null, clipPaths: [] }),
  setOutputDir: (dir) => set({ outputDir: dir }),
  setSplitSettings: (settings) => set((s) => ({ splitSettings: { ...s.splitSettings, ...settings } })),
  setSplitPoints: (points) => set({ splitPoints: points }),
  setCaptionStyle: (style) => set((s) => ({ captionStyle: { ...s.captionStyle, ...style } })),
  setTranscription: (t) => set({ transcription: t }),
  setWhisperModelSize: (size) => set({ whisperModelSize: size }),
  setAvailableModels: (models) => set({ availableModels: models }),
  setOllama: (status) => set({ ollama: status }),
  setProcessing: (p) => set({ processing: p }),
  setProgress: (p) => set({ progress: p }),
  setClipPaths: (paths) => set({ clipPaths: paths }),
  setError: (err) => set({ error: err }),
  reset: () => set({
    stage: 'import',
    video: null,
    outputDir: null,
    splitSettings: DEFAULT_SPLIT_SETTINGS,
    splitPoints: [],
    captionStyle: DEFAULT_CAPTION_STYLE,
    transcription: null,
    processing: false,
    progress: null,
    clipPaths: [],
    error: null
  })
}))
