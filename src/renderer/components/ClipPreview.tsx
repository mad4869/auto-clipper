import { useState, useCallback } from 'react'
import { useStore } from '../store'

function formatTime (seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ClipPreview () {
  const video = useStore((s) => s.video)
  const splitPoints = useStore((s) => s.splitPoints)
  const outputDir = useStore((s) => s.outputDir)
  const setSplitPoints = useStore((s) => s.setSplitPoints)
  const setStage = useStore((s) => s.setStage)

  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editStart, setEditStart] = useState(0)
  const [editEnd, setEditEnd] = useState(0)

  const handleDelete = useCallback((index: number) => {
    const newPoints = splitPoints
      .filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, index: i }))
    setSplitPoints(newPoints)
  }, [splitPoints, setSplitPoints])

  const handleEdit = useCallback((index: number) => {
    const p = splitPoints[index]
    setEditingIndex(index)
    setEditStart(p.start)
    setEditEnd(p.end)
  }, [splitPoints])

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null) return
    const newPoints = [...splitPoints]
    newPoints[editingIndex] = {
      ...newPoints[editingIndex],
      start: Math.min(editStart, editEnd),
      end: Math.max(editStart, editEnd)
    }
    setSplitPoints(newPoints)
    setEditingIndex(null)
  }, [editingIndex, editStart, editEnd, splitPoints, setSplitPoints])

  return (
    <div className="view preview-view">
      <div className="card">
        <h1>Preview Clips</h1>
        <p className="hint">
          {splitPoints.length} clip{splitPoints.length !== 1 ? 's' : ''} ready.
          Output to: {outputDir}
        </p>

        <div className="clip-summary">
          <div className="summary-row">
            <span>Total clips:</span>
            <span>{splitPoints.length}</span>
          </div>
          <div className="summary-row">
            <span>Total duration:</span>
            <span>{formatTime(splitPoints.reduce((sum, p) => sum + (p.end - p.start), 0))}</span>
          </div>
          <div className="summary-row">
            <span>Average duration:</span>
            <span>{formatTime(splitPoints.reduce((sum, p) => sum + (p.end - p.start), 0) / splitPoints.length)}</span>
          </div>
        </div>

        <div className="clip-list">
          {splitPoints.map((point, i) => (
            <div key={i} className="clip-item">
              <div className="clip-index">#{i + 1}</div>
              <div className="clip-times">
                {formatTime(point.start)} - {formatTime(point.end)}
                <span className="clip-duration">({formatTime(point.end - point.start)})</span>
              </div>
              <div className="clip-actions">
                <button className="btn btn-small" onClick={() => handleEdit(i)}>Edit</button>
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(i)}>Remove</button>
              </div>

              {editingIndex === i && (
                <div className="clip-edit">
                  <div className="edit-row">
                    <label>Start: {formatTime(editStart)}</label>
                    <input
                      type="range"
                      min={0}
                      max={video?.duration ?? 0}
                      step={1}
                      value={editStart}
                      onChange={(e) => setEditStart(parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="edit-row">
                    <label>End: {formatTime(editEnd)}</label>
                    <input
                      type="range"
                      min={0}
                      max={video?.duration ?? 0}
                      step={1}
                      value={editEnd}
                      onChange={(e) => setEditEnd(parseFloat(e.target.value))}
                    />
                  </div>
                  <button className="btn btn-small btn-primary" onClick={handleSaveEdit}>Save</button>
                  <button className="btn btn-small" onClick={() => setEditingIndex(null)}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="button-row">
          <button className="btn" onClick={() => setStage('split-settings')}>Back</button>
          <button className="btn btn-primary" onClick={() => setStage('caption-settings')}>
            Configure Captions
          </button>
        </div>
      </div>
    </div>
  )
}
