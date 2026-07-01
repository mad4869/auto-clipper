import { describe, it, expect } from 'vitest'
import { computeSplitPoints, computeSilenceBasedSplitPoints, computeSceneBasedSplitPoints } from '../src/main/ffmpeg/split'

describe('computeSplitPoints - fixed duration', () => {
  it('splits video into equal fixed-duration segments', () => {
    const points = computeSplitPoints(120, { mode: 'fixed-duration', duration: 30 })
    expect(points).toHaveLength(4)
    expect(points[0]).toEqual({ index: 0, start: 0, end: 30 })
    expect(points[1]).toEqual({ index: 1, start: 30, end: 60 })
    expect(points[2]).toEqual({ index: 2, start: 60, end: 90 })
    expect(points[3]).toEqual({ index: 3, start: 90, end: 120 })
  })

  it('handles remaining partial segment', () => {
    const points = computeSplitPoints(100, { mode: 'fixed-duration', duration: 30 })
    expect(points).toHaveLength(4)
    expect(points[3]).toEqual({ index: 3, start: 90, end: 100 })
  })

  it('returns single segment when duration is shorter than clip length', () => {
    const points = computeSplitPoints(20, { mode: 'fixed-duration', duration: 30 })
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({ index: 0, start: 0, end: 20 })
  })

  it('handles exactly matching duration', () => {
    const points = computeSplitPoints(60, { mode: 'fixed-duration', duration: 60 })
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({ index: 0, start: 0, end: 60 })
  })

  it('uses default duration of 60 when not specified', () => {
    const points = computeSplitPoints(120, { mode: 'fixed-duration' })
    expect(points).toHaveLength(2)
    expect(points[0].end - points[0].start).toBe(60)
  })
})

describe('computeSplitPoints - fixed count', () => {
  it('splits video into N equal segments', () => {
    const points = computeSplitPoints(120, { mode: 'fixed-count', count: 4 })
    expect(points).toHaveLength(4)
    expect(points[0]).toEqual({ index: 0, start: 0, end: 30 })
    expect(points[1]).toEqual({ index: 1, start: 30, end: 60 })
    expect(points[2]).toEqual({ index: 2, start: 60, end: 90 })
    expect(points[3]).toEqual({ index: 3, start: 90, end: 120 })
  })

  it('produces fractional segments when duration not evenly divisible', () => {
    const points = computeSplitPoints(100, { mode: 'fixed-count', count: 3 })
    expect(points).toHaveLength(3)
    expect(points[2].end).toBeCloseTo(100)
  })

  it('uses default count of 5 when not specified', () => {
    const points = computeSplitPoints(100, { mode: 'fixed-count' })
    expect(points).toHaveLength(5)
  })

  it('handles count of 1', () => {
    const points = computeSplitPoints(100, { mode: 'fixed-count', count: 1 })
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({ index: 0, start: 0, end: 100 })
  })
})

describe('computeSilenceBasedSplitPoints', () => {
  it('returns single segment when no silence points given', () => {
    const points = computeSilenceBasedSplitPoints(120, [])
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({ index: 0, start: 0, end: 120 })
  })

  it('splits at silence points respecting min clip duration', () => {
    const points = computeSilenceBasedSplitPoints(120, [30, 60, 90], 10, 120)
    expect(points).toHaveLength(4)
    expect(points[0]).toEqual({ index: 0, start: 0, end: 30 })
    expect(points[1]).toEqual({ index: 1, start: 30, end: 60 })
    expect(points[2]).toEqual({ index: 2, start: 60, end: 90 })
    expect(points[3]).toEqual({ index: 3, start: 90, end: 120 })
  })

  it('skips silence points that are too close together', () => {
    const points = computeSilenceBasedSplitPoints(120, [5, 30, 55, 80, 105], 20, 120)
    expect(points.length).toBeGreaterThanOrEqual(2)
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      if (i < points.length - 1) {
        expect(p.end - p.start).toBeGreaterThanOrEqual(20)
      }
    }
  })

  it('respects max clip duration by forcing splits', () => {
    const points = computeSilenceBasedSplitPoints(300, [150], 10, 120)
    expect(points.length).toBeGreaterThanOrEqual(3)
    for (const p of points) {
      expect(p.end - p.start).toBeLessThanOrEqual(122)
    }
  })

  it('includes trailing segment after last silence point', () => {
    const points = computeSilenceBasedSplitPoints(100, [40], 10, 120)
    expect(points).toHaveLength(2)
    expect(points[1]).toEqual({ index: 1, start: 40, end: 100 })
  })
})

describe('computeSceneBasedSplitPoints', () => {
  it('works the same as silence-based with scene timestamps', () => {
    const points = computeSceneBasedSplitPoints(200, [50, 100, 150], 20, 120)
    expect(points.length).toBeGreaterThanOrEqual(3)
    expect(points[0].start).toBe(0)
    expect(points[points.length - 1].end).toBe(200)
  })
})
