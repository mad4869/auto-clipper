import { useState, useCallback } from 'react'
import { useStore } from '../store'

export default function SplitSettingsView () {
  const video = useStore((s) => s.video)
  const outputDir = useStore((s) => s.outputDir)
  const splitSettings = useStore((s) => s.splitSettings)
  const setSplitSettings = useStore((s) => s.setSplitSettings)
  const setSplitPoints = useStore((s) => s.setSplitPoints)
  const setStage = useStore((s) => s.setStage)
  const setProcessing = useStore((s) => s.setProcessing)
  const setProgress = useStore((s) => s.setProgress)
  const setError = useStore((s) => s.setError)
  const ollama = useStore((s) => s.ollama)
  const selectedOllamaModel = useStore((s) => s.selectedOllamaModel)
  const transcription = useStore((s) => s.transcription)
  const setTranscription = useStore((s) => s.setTranscription)
  const whisperModelSize = useStore((s) => s.whisperModelSize)

  const [detecting, setDetecting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const handleTranscribeAndSplit = useCallback(async () => {
    if (!video || !outputDir) return

    setTranscribing(true)
    setProcessing(true)
    let currentTranscription = transcription

    try {
      const api = (window as any).electronAPI

      // Step 1: Transcribe if not already done
      if (!currentTranscription) {
        const tempAudioPath = `${outputDir}/.temp_audio_${Date.now()}.wav`
        setProgress({ stage: 'Extracting audio...', percent: 10, detail: '' })
        await api.extractAudio({ videoPath: video.path, outputPath: tempAudioPath })

        setProgress({ stage: 'Transcribing audio...', percent: 30, detail: 'This may take a minute...' })
        const result = await api.transcribe({ audioPath: tempAudioPath, modelSize: whisperModelSize })
        currentTranscription = { text: result.text, words: result.words, language: result.language }
        setTranscription(currentTranscription)
      }

      // Step 2: Ask the LLM for highlight split points
      setProgress({ stage: 'Asking AI for best highlights...', percent: 70, detail: '' })
      const highlights = await api.llmDetectHighlights({
        transcript: currentTranscription.text,
        duration: video.duration,
        numberOfHighlights: splitSettings.count ?? 5,
        model: selectedOllamaModel
      })

      if (highlights && highlights.length > 0) {
        const points = highlights.map((h: any, i: number) => ({
          index: i,
          start: h.startTime,
          end: h.endTime
        }))
        setSplitPoints(points)
        setStage('preview')
      } else {
        setError('AI did not return any highlights. Try using a different split mode instead.')
      }
    } catch (err: any) {
      setError(err.message || 'AI-assisted splitting failed')
    } finally {
      setTranscribing(false)
      setProcessing(false)
      setProgress(null)
    }
  }, [video, outputDir, transcription, whisperModelSize, selectedOllamaModel, splitSettings.count, setSplitPoints, setStage, setProcessing, setProgress, setTranscription, setError])

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

  const isAiMode = splitSettings.mode === 'ai-highlights' as any

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
            {ollama?.running && <option value="ai-highlights">🤖 AI Highlights (LLM)</option>}
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

        {isAiMode && (
          <div className="form-group">
            <label>Number of Highlights: {splitSettings.count}</label>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={splitSettings.count ?? 5}
              onChange={(e) => setSplitSettings({ count: parseInt(e.target.value) })}
            />
            <div className="range-labels">
              <span>1</span>
              <span>10</span>
            </div>
            <p className="hint" style={{ marginTop: '0.5rem' }}>
              The AI will transcribe your video and pick the {splitSettings.count ?? 5} most engaging segments automatically.
              {transcription && ' ✓ Transcript already available — AI will skip transcription.'}
            </p>
          </div>
        )}

        <div className="button-row">
          <button className="btn" onClick={() => setStage('import')}>Back</button>
          {isAiMode ? (
            <button
              className="btn btn-primary"
              onClick={handleTranscribeAndSplit}
              disabled={transcribing || !outputDir}
            >
              {transcribing ? 'Analyzing with AI...' : '🤖 Auto-Split with AI'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCompute} disabled={detecting}>
              {detecting ? 'Detecting...' : 'Preview Clips'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
