import { useState, useCallback } from 'react'
import { useStore } from '../store'

export default function SplitSettingsView () {
  const video = useStore((s) => s.video)
  const splitSettings = useStore((s) => s.splitSettings)
  const setSplitSettings = useStore((s) => s.setSplitSettings)
  const setSplitPoints = useStore((s) => s.setSplitPoints)
  const setStage = useStore((s) => s.setStage)
  const setProcessing = useStore((s) => s.setProcessing)
  const setError = useStore((s) => s.setError)
  const ollama = useStore((s) => s.ollama)

  const [detecting, setDetecting] = useState(false)

  const handleCompute = useCallback(async () => {
    if (!video) return

    setProcessing(true)
    try {
      const api = (window as any).electronAPI
      let points: Array<{ start: number; end: number; index: number }> = []

      if (splitSettings.mode === 'silence') {
        setDetecting(true)
        const timestamps = await api.detectSilencePoints({
          inputPath: video.path,
          silenceDuration: splitSettings.silenceDuration,
          silenceThreshold: splitSettings.silenceThreshold
        })
        points = await api.computeSilenceSplitPoints({
          duration: video.duration,
          timestamps,
          minClipDuration: splitSettings.minClipDuration,
          maxClipDuration: splitSettings.maxClipDuration
        })
        setDetecting(false)
      } else if (splitSettings.mode === 'scene') {
        setDetecting(true)
        const timestamps = await api.detectSceneChanges({
          inputPath: video.path,
          threshold: splitSettings.sceneThreshold
        })
        points = await api.computeSceneSplitPoints({
          duration: video.duration,
          timestamps,
          minClipDuration: splitSettings.minClipDuration,
          maxClipDuration: splitSettings.maxClipDuration
        })
        setDetecting(false)
      } else {
        points = await api.computeSplitPoints({
          duration: video.duration,
          settings: splitSettings
        })
      }

      setSplitPoints(points)
      setStage('preview')
    } catch (err: any) {
      setError(err.message || 'Failed to compute split points')
    } finally {
      setProcessing(false)
      setDetecting(false)
    }
  }, [video, splitSettings, setSplitPoints, setStage, setProcessing, setError])

  return (
    <div className="view split-settings-view">
      <div className="card">
        <h1>Split Settings</h1>
        <p className="hint">
          Video: {video?.name} ({video ? `${Math.floor((video.duration || 0) / 60)}m ${Math.floor((video.duration || 0) % 60)}s` : ''})
        </p>

        <div className="form-group">
          <label>Split Mode</label>
          <select
            value={splitSettings.mode}
            onChange={(e) => setSplitSettings({ mode: e.target.value as any })}
          >
            <option value="fixed-duration">Fixed Duration</option>
            <option value="fixed-count">Fixed Count</option>
            <option value="silence">Silence-Based</option>
            <option value="scene">Scene Change</option>
          </select>
        </div>

        {splitSettings.mode === 'fixed-duration' && (
          <div className="form-group">
            <label>Clip Duration: {splitSettings.duration}s</label>
            <input
              type="range"
              min={15}
              max={180}
              step={5}
              value={splitSettings.duration ?? 60}
              onChange={(e) => setSplitSettings({ duration: parseInt(e.target.value) })}
            />
            <div className="range-labels">
              <span>15s</span>
              <span>180s</span>
            </div>
          </div>
        )}

        {splitSettings.mode === 'fixed-count' && (
          <div className="form-group">
            <label>Number of Clips: {splitSettings.count}</label>
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={splitSettings.count ?? 5}
              onChange={(e) => setSplitSettings({ count: parseInt(e.target.value) })}
            />
            <div className="range-labels">
              <span>2</span>
              <span>20</span>
            </div>
            {video && (
              <div className="clip-estimate">
                ~{Math.floor((video.duration / (splitSettings.count ?? 5)))}s per clip
              </div>
            )}
          </div>
        )}

        {(splitSettings.mode === 'silence' || splitSettings.mode === 'scene') && (
          <>
            <div className="form-group">
              <label>Minimum Clip Duration: {splitSettings.minClipDuration}s</label>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={splitSettings.minClipDuration ?? 10}
                onChange={(e) => setSplitSettings({ minClipDuration: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Maximum Clip Duration: {splitSettings.maxClipDuration}s</label>
              <input
                type="range"
                min={30}
                max={300}
                step={10}
                value={splitSettings.maxClipDuration ?? 120}
                onChange={(e) => setSplitSettings({ maxClipDuration: parseInt(e.target.value) })}
              />
            </div>
            {splitSettings.mode === 'silence' && (
              <div className="form-group">
                <label>Silence Threshold: {splitSettings.silenceThreshold}</label>
                <select
                  value={splitSettings.silenceThreshold}
                  onChange={(e) => setSplitSettings({ silenceThreshold: e.target.value })}
                >
                  <option value="-20dB">-20dB (Strict)</option>
                  <option value="-30dB">-30dB (Normal)</option>
                  <option value="-40dB">-40dB (Lenient)</option>
                  <option value="-50dB">-50dB (Very Lenient)</option>
                </select>
              </div>
            )}
          </>
        )}

        <div className="button-row">
          <button className="btn" onClick={() => setStage('import')}>Back</button>
          <button className="btn btn-primary" onClick={handleCompute} disabled={detecting}>
            {detecting ? 'Detecting...' : `Preview Clips`}
          </button>
        </div>

        {splitSettings.mode === 'silence' && ollama?.running && (
          <div className="llm-note">
            <span className="badge badge-llm">LLM</span>
            Ollama is available. After splitting, you can use AI-assisted highlight detection on the Preview screen.
          </div>
        )}
      </div>
    </div>
  )
}
