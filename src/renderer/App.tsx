import { useEffect } from 'react'
import { useStore } from './store'
import ImportView from './components/ImportView'
import SplitSettingsView from './components/SplitSettingsView'
import ClipPreview from './components/ClipPreview'
import CaptionSettingsView from './components/CaptionSettingsView'
import ExportProgress from './components/ExportProgress'
import SettingsPanel from './components/SettingsPanel'
import Navigation from './components/Navigation'

export default function App () {
  const stage = useStore((s) => s.stage)
  const error = useStore((s) => s.error)
  const setError = useStore((s) => s.setError)

  useEffect(() => {
    const init = async () => {
      const api = (window as any).electronAPI
      if (!api) return

      try {
        const models = await api.getAvailableModels()
        useStore.getState().setAvailableModels(models)
      } catch {}

      try {
        const ollamaStatus = await api.checkOllama()
        useStore.getState().setOllama(ollamaStatus)
      } catch {}
    }
    init()
  }, [])

  return (
    <div className="app">
      <Navigation />
      <main className="main-content">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="error-dismiss">&times;</button>
          </div>
        )}

        {stage === 'import' && <ImportView />}
        {stage === 'split-settings' && <SplitSettingsView />}
        {stage === 'preview' && <ClipPreview />}
        {stage === 'caption-settings' && <CaptionSettingsView />}
        {(stage === 'exporting' || stage === 'done') && <ExportProgress />}
      </main>
    </div>
  )
}
