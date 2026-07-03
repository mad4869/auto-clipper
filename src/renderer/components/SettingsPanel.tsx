import { useState } from 'react'
import { useStore } from '../store'

export default function SettingsPanel () {
  const [open, setOpen] = useState(false)
  const ollama = useStore((s) => s.ollama)
  const selectedOllamaModel = useStore((s) => s.selectedOllamaModel)
  const setSelectedOllamaModel = useStore((s) => s.setSelectedOllamaModel)
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
                <div className="ollama-models" style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Active LLM Model:</label>
                  <select
                    value={selectedOllamaModel || ollama.models[0].name}
                    onChange={(e) => setSelectedOllamaModel(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', background: '#2a2a2a', color: '#fff', border: '1px solid #444' }}
                  >
                    {ollama.models.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
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
