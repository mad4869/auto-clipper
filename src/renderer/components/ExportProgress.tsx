import { useStore } from '../store'

export default function ExportProgress () {
  const stage = useStore((s) => s.stage)
  const progress = useStore((s) => s.progress)
  const clipPaths = useStore((s) => s.clipPaths)
  const outputDir = useStore((s) => s.outputDir)
  const splitPoints = useStore((s) => s.splitPoints)
  const setStage = useStore((s) => s.setStage)
  const reset = useStore((s) => s.reset)

  const percent = progress?.percent ?? 0

  return (
    <div className="view export-view">
      <div className="card">
        <h1>{stage === 'done' ? 'Export Complete' : 'Exporting...'}</h1>

        {stage === 'exporting' && (
          <div className="progress-section">
            <div className="progress-stage">{progress?.stage || 'Processing...'}</div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="progress-percent">{Math.round(percent)}%</div>
          </div>
        )}

        {stage === 'done' && (
          <div className="done-section">
            <div className="done-icon">&#10003;</div>
            <p className="done-message">
              Successfully exported {clipPaths.length} clip{clipPaths.length !== 1 ? 's' : ''}
            </p>

            <div className="done-summary">
              <div>Output: {outputDir}</div>
              <div className="file-list">
                {clipPaths.map((path, i) => (
                  <div key={i} className="file-item">
                    <span className="file-icon">&#9654;</span>
                    <span>{path.split('/').pop() || path.split('\\').pop()}</span>
                    <span className="file-duration">
                      ({Math.floor(splitPoints[i]?.end - splitPoints[i]?.start || 0)}s)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="done-actions">
              <button className="btn btn-primary" onClick={() => setStage('import')}>
                New Project
              </button>
              <button className="btn" onClick={reset}>
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
