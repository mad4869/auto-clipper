import { useCallback } from 'react'
import { useStore } from '../store'

function formatDuration (seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatSize (bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function ImportView () {
  const setVideo = useStore((s) => s.setVideo)
  const video = useStore((s) => s.video)
  const setOutputDir = useStore((s) => s.setOutputDir)
  const outputDir = useStore((s) => s.outputDir)
  const setStage = useStore((s) => s.setStage)
  const setError = useStore((s) => s.setError)

  const handleSelectVideo = useCallback(async () => {
    try {
      const api = (window as any).electronAPI
      const result = await api.selectVideo()
      if (result) {
        setVideo(result)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to select video')
    }
  }, [setVideo, setError])

  const handleSelectOutput = useCallback(async () => {
    try {
      const api = (window as any).electronAPI
      const dir = await api.selectOutputDir()
      if (dir) {
        setOutputDir(dir)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to select output directory')
    }
  }, [setOutputDir, setError])

  return (
    <div className="view import-view">
      <div className="card">
        <h1>Import Video</h1>
        <p className="hint">Select a video file to split into clips and add captions.</p>

        <div className="file-select" onClick={handleSelectVideo}>
          {video ? (
            <div className="video-info">
              <div className="video-icon">&#9654;</div>
              <div>
                <div className="video-name">{video.name}</div>
                <div className="video-meta">
                  {formatDuration(video.duration)} &middot; {formatSize(video.size)}
                </div>
              </div>
              <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); setVideo(null) }}>Change</button>
            </div>
          ) : (
            <div className="dropzone">
              <div className="dropzone-icon">&#43;</div>
              <div>Click to select a video file</div>
              <div className="dropzone-hint">MP4, MOV, MKV, AVI, WebM</div>
            </div>
          )}
        </div>

        <div className="output-select">
          <label>Output Directory</label>
          <div className="output-row">
            <input
              type="text"
              value={outputDir || ''}
              placeholder="Choose where to save clips..."
              readOnly
            />
            <button className="btn" onClick={handleSelectOutput}>Browse</button>
          </div>
        </div>

        <button
          className="btn btn-primary"
          disabled={!video || !outputDir}
          onClick={() => setStage('split-settings')}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
