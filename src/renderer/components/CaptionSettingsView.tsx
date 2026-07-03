import { useState, useCallback } from 'react'
import { useStore } from '../store'
import { FONTS } from '../styles/fonts'

export default function CaptionSettingsView () {
  const video = useStore((s) => s.video)
  const splitPoints = useStore((s) => s.splitPoints)
  const outputDir = useStore((s) => s.outputDir)
  const captionStyle = useStore((s) => s.captionStyle)
  const setCaptionStyle = useStore((s) => s.setCaptionStyle)
  const whisperModelSize = useStore((s) => s.whisperModelSize)
  const setTranscription = useStore((s) => s.setTranscription)
  const setStage = useStore((s) => s.setStage)
  const setProcessing = useStore((s) => s.setProcessing)
  const setProgress = useStore((s) => s.setProgress)
  const setError = useStore((s) => s.setError)
  const setClipPaths = useStore((s) => s.setClipPaths)
  const ollama = useStore((s) => s.ollama)
  const selectedOllamaModel = useStore((s) => s.selectedOllamaModel)
  const transcription = useStore((s) => s.transcription)

  const [transcribing, setTranscribing] = useState(false)
  const [cleaningTranscript, setCleaningTranscript] = useState(false)

  const handleTranscribe = useCallback(async () => {
    if (!video || !outputDir) return

    setTranscribing(true)
    setProcessing(true)
    try {
      const api = (window as any).electronAPI
      const tempAudioPath = `${outputDir}/.temp_audio_${Date.now()}.wav`
      setProgress({ stage: 'Extracting audio...', percent: 10, detail: '' })

      await api.extractAudio({ videoPath: video.path, outputPath: tempAudioPath })

      setProgress({ stage: 'Transcribing...', percent: 30, detail: '' })

      const result = await api.transcribe({
        audioPath: tempAudioPath,
        modelSize: whisperModelSize
      })

      setTranscription({
        text: result.text,
        words: result.words,
        language: result.language
      })

      setProgress({ stage: 'Done', percent: 100, detail: 'Transcription complete' })
    } catch (err: any) {
      setError(err.message || 'Transcription failed')
    } finally {
      setTranscribing(false)
      setProcessing(false)
      setProgress(null)
    }
  }, [video, outputDir, whisperModelSize, setTranscription, setProcessing, setProgress, setError])

  const handleCleanTranscript = useCallback(async () => {
    if (!transcription) return
    setCleaningTranscript(true)
    try {
      const api = (window as any).electronAPI
      const cleaned = await api.llmCleanTranscript({
        transcript: transcription.text,
        options: { removeFillers: true, fixGrammar: false, preservePunctuation: true },
        model: selectedOllamaModel
      })
      if (cleaned) {
        setTranscription({ ...transcription, text: cleaned })
      }
    } catch (err: any) {
      setError(err.message || 'Transcript cleanup failed')
    } finally {
      setCleaningTranscript(false)
    }
  }, [transcription, selectedOllamaModel, setTranscription, setError])

  const handleExport = useCallback(async () => {
    if (!video || !outputDir || !transcription || splitPoints.length === 0) return

    setProcessing(true)
    setStage('exporting')

    try {
      const api = (window as any).electronAPI

      setProgress({ stage: 'Splitting clips...', percent: 10, detail: '' })

      const clipPaths = await api.splitVideo({
        inputPath: video.path,
        outputDir,
        splitPoints
      })
      setClipPaths(clipPaths)

      const total = clipPaths.length
      for (let i = 0; i < clipPaths.length; i++) {
        const clipPath = clipPaths[i]
        const percent = 10 + ((i + 1) / total) * 80
        setProgress({
          stage: `Burning captions on clip ${i + 1}/${total}...`,
          percent,
          detail: ''
        })

        await api.burnCaptions({
          inputPath: clipPath,
          outputDir,
          words: transcription.words,
          style: captionStyle,
          splitPoint: splitPoints[i],
          exportSrt: true,
          exportAss: true
        })
      }

      setProgress({ stage: 'Done', percent: 100, detail: 'All clips processed!' })
      setStage('done')
    } catch (err: any) {
      setError(err.message || 'Export failed')
      setStage('caption-settings')
    } finally {
      setProcessing(false)
    }
  }, [video, outputDir, transcription, splitPoints, captionStyle, setProcessing, setProgress, setClipPaths, setStage, setError])

  return (
    <div className="view caption-settings-view">
      <div className="card">
        <h1>Caption Settings</h1>
        <p className="hint">Style your captions like TikTok/Reels. Transcribe first, then customize.</p>

        <section className="section">
          <h2>1. Transcribe</h2>
          {!transcription ? (
            <div>
              <p className="hint">Run speech-to-text on the first clip to get word timestamps.</p>
              <button
                className="btn btn-primary"
                onClick={handleTranscribe}
                disabled={transcribing}
              >
                {transcribing ? 'Transcribing...' : 'Transcribe Audio'}
              </button>
            </div>
          ) : (
            <div className="transcript-preview">
              <div className="transcript-text">
                <strong>Transcript ({transcription.language}):</strong>
                <p>{transcription.text}</p>
                <small>{transcription.words.length} words with timestamps</small>
              </div>
              <div className="button-row">
                <button className="btn btn-small btn-secondary" onClick={handleTranscribe}>
                  Retranscribe
                </button>
                {ollama?.running && (
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={handleCleanTranscript}
                    disabled={cleaningTranscript}
                  >
                    {cleaningTranscript ? 'Cleaning...' : 'Clean up (LLM)'}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="section">
          <h2>2. Style</h2>

          <div className="form-group">
            <label>Font</label>
            <select
              value={captionStyle.font}
              onChange={(e) => setCaptionStyle({ font: e.target.value })}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Font Size: {captionStyle.fontSize}px</label>
            <input
              type="range"
              min={16}
              max={48}
              step={2}
              value={captionStyle.fontSize}
              onChange={(e) => setCaptionStyle({ fontSize: parseInt(e.target.value) })}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Text Color</label>
              <input
                type="color"
                value={captionStyle.fontColor}
                onChange={(e) => setCaptionStyle({ fontColor: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Highlight Color</label>
              <input
                type="color"
                value={captionStyle.highlightColor}
                onChange={(e) => setCaptionStyle({ highlightColor: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Position</label>
            <select
              value={captionStyle.position}
              onChange={(e) => setCaptionStyle({ position: e.target.value as any })}
            >
              <option value="lower-third">Lower Third</option>
              <option value="center">Center</option>
              <option value="top">Top</option>
            </select>
          </div>

          <div className="form-group">
            <label>Animation Style</label>
            <select
              value={captionStyle.animation}
              onChange={(e) => setCaptionStyle({ animation: e.target.value as any })}
            >
              <option value="pop">Pop (word-by-word)</option>
              <option value="karaoke">Karaoke (highlighted word)</option>
              <option value="fade">Fade in/out</option>
            </select>
          </div>

          <div className="form-group">
            <label>Max Words Per Line: {captionStyle.maxWordsPerLine}</label>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={captionStyle.maxWordsPerLine}
              onChange={(e) => setCaptionStyle({ maxWordsPerLine: parseInt(e.target.value) })}
            />
          </div>
        </section>

        <div className="button-row">
          <button className="btn" onClick={() => setStage('preview')}>Back</button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={!transcription}
          >
            Export All Clips
          </button>
        </div>
      </div>
    </div>
  )
}
