import { useStore, type AppStage } from '../store'
import SettingsPanel from './SettingsPanel'

const STAGES: { key: AppStage; label: string }[] = [
  { key: 'import', label: 'Import' },
  { key: 'split-settings', label: 'Split' },
  { key: 'preview', label: 'Preview' },
  { key: 'caption-settings', label: 'Captions' },
  { key: 'exporting', label: 'Export' }
]

export default function Navigation () {
  const stage = useStore((s) => s.stage)
  const video = useStore((s) => s.video)
  const splitPoints = useStore((s) => s.splitPoints)

  const currentIdx = STAGES.findIndex((s) => s.key === stage)

  return (
    <nav className="nav">
      <div className="nav-title">Video Clipper</div>
      <div className="nav-steps">
        {STAGES.map((s, i) => {
          let isActive = i === currentIdx
          let isComplete = i < currentIdx
          let isDisabled = false

          if (s.key === 'split-settings' && !video) isDisabled = true
          if (s.key === 'preview' && splitPoints.length === 0) isDisabled = true
          if (s.key === 'caption-settings' && splitPoints.length === 0) isDisabled = true

          return (
            <div
              key={s.key}
              className={`nav-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''} ${isDisabled ? 'disabled' : ''}`}
            >
              <span className="nav-step-number">{isComplete ? '\u2713' : i + 1}</span>
              <span className="nav-step-label">{s.label}</span>
            </div>
          )
        })}
      </div>
      <SettingsPanel />
    </nav>
  )
}
