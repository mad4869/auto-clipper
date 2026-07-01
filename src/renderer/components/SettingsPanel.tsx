import { useState } from 'react'
import { useStore } from '../store'

export default function SettingsPanel () {
  const [open, setOpen] = useState(false)
  const ollama = useStore((s) => s.ollama)
  const availableModels = useStore((s) => s.availableModels)
  const whisperModelSize = useStore((s) => s.whisperModelSize)
  const setWhisperModelSize = useStore((s) => s.setWhisperModelSize)

  return (
    <>
      <button className="settings-toggle" onClick={() => setOpen(!open)} title="Settings">
        {open ? '\u2715' : '\u2699'}
      </button>

      {open && (
        <div className="settings-overlay" onClick={() => setOpen(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>

            <section>
              <h3>Whisper Model</h3>
              <p className="setting-hint">Used for speech-to-text transcription. Larger models are more accurate but slower.</p>
              <select
                value={whisperModelSize}
                onChange={(e) => setWhisperModelSize(e.target.value)}
              >
                {['tiny', 'base', 'small', 'medium', 'large'].map((size) => {
                  const isAvailable = availableModels.some((m) => m.size === size)
                  return (
                    <option key={size} value={size} disabled={!isAvailable}>
                      {size} {isAvailable ? '\u2713' : '(not downloaded)'}
                    </option>
                  )
                })}
              </select>
              <div className="model-status">
                {availableModels.length > 0
                  ? `Models found: ${availableModels.length}`
                  : 'No models detected. Place .bin files in the models directory.'}
              </div>
            </section>

            <section>
              <h3>Ollama / Local LLM</h3>
              <p className="setting-hint">
                Optional. Used for highlight detection, title generation, and transcript cleanup.
                Requires Ollama running locally with a model pulled.
              </p>
              <div className={`status-indicator ${ollama?.running ? 'online' : 'offline'}`}>
                {ollama?.running ? 'Connected' : 'Not available'}
              </div>
              {ollama?.running && ollama.models.length > 0 && (
                <div className="ollama-models">
                  Available models: {ollama.models.map((m) => m.name).join(', ')}
                </div>
              )}
              {!ollama?.running && (
                <div className="ollama-setup">
                  <p>To enable LLM features:</p>
                  <ol>
                    <li>Install Ollama from ollama.ai</li>
                    <li>Run: <code>ollama pull llama3.2</code></li>
                    <li>Start Ollama and restart this app</li>
                  </ol>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  )
}
