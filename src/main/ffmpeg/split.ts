import { join, dirname, basename, extname } from 'node:path'
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { runFfmpeg, getVideoDuration, resolveFfmpegPath } from './ffmpeg'
import { buildSilenceDetectArgs, buildSceneDetectArgs } from './filters'
import { execFile } from 'node:child_process'
import { AppError, ErrorCodes } from '../utils/errors'

export interface SplitPoint {
  start: number
  end: number
  index: number
}

export type SplitMode = 'fixed-duration' | 'fixed-count' | 'silence' | 'scene'

export interface SplitSettings {
  mode: SplitMode
  duration?: number
  count?: number
  silenceDuration?: number
  silenceThreshold?: string
  sceneThreshold?: number
  minClipDuration?: number
  maxClipDuration?: number
}

export const DEFAULT_SPLIT_SETTINGS: SplitSettings = {
  mode: 'fixed-duration',
  duration: 60,
  count: 5,
  silenceDuration: 0.5,
  silenceThreshold: '-30dB',
  sceneThreshold: 0.3,
  minClipDuration: 10,
  maxClipDuration: 120
}

function parseTimestamp (ts: string): number {
  const parts = ts.split(':')
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  }
  return parseFloat(parts[0])
}

export function computeSplitPoints (duration: number, settings: SplitSettings): SplitPoint[] {
  const points: SplitPoint[] = []

  switch (settings.mode) {
    case 'fixed-duration': {
      const segDuration = settings.duration ?? 60
      const count = Math.ceil(duration / segDuration)
      for (let i = 0; i < count; i++) {
        points.push({
          index: i,
          start: i * segDuration,
          end: Math.min((i + 1) * segDuration, duration)
        })
      }
      break
    }

    case 'fixed-count': {
      const count = settings.count ?? 5
      const segDuration = duration / count
      for (let i = 0; i < count; i++) {
        points.push({
          index: i,
          start: i * segDuration,
          end: (i + 1) * segDuration
        })
      }
      break
    }

    case 'silence':
    case 'scene':
      break
  }

  return points
}

export async function detectSilencePoints (
  inputPath: string,
  silenceDuration: number = 0.5,
  silenceThreshold: string = '-30dB'
): Promise<number[]> {
  const ffmpegPath = resolveFfmpegPath()
  const args = buildSilenceDetectArgs(inputPath, silenceDuration, silenceThreshold)

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 10 }, (_error, _stdout, stderr) => {
      const timestamps: number[] = []
      const regex = /silence_end:\s*([\d.]+)/g
      let match: RegExpExecArray | null

      while ((match = regex.exec(stderr)) !== null) {
        timestamps.push(parseFloat(match[1]))
      }

      resolve(timestamps)
    })
  })
}

export async function detectSceneChanges (
  inputPath: string,
  threshold: number = 0.3
): Promise<number[]> {
  const ffmpegPath = resolveFfmpegPath()
  const args = buildSceneDetectArgs(inputPath, threshold)

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 10 }, (_error, _stdout, stderr) => {
      const timestamps: number[] = []
      const regex = /pts_time:\s*([\d.]+)/g
      let match: RegExpExecArray | null

      while ((match = regex.exec(stderr)) !== null) {
        timestamps.push(parseFloat(match[1]))
      }

      resolve(timestamps)
    })
  })
}

export function computeSilenceBasedSplitPoints (
  duration: number,
  silenceTimestamps: number[],
  minClipDuration: number = 10,
  maxClipDuration: number = 120
): SplitPoint[] {
  if (silenceTimestamps.length === 0) {
    return [{ index: 0, start: 0, end: duration }]
  }

  const points: SplitPoint[] = []
  let segmentStart = 0
  let index = 0

  for (const ts of silenceTimestamps) {
    if (ts - segmentStart < minClipDuration) continue
    if (ts - segmentStart > maxClipDuration) {
      const adjustedEnd = segmentStart + maxClipDuration
      points.push({ index: index++, start: segmentStart, end: adjustedEnd })
      segmentStart = adjustedEnd
      continue
    }
    points.push({ index: index++, start: segmentStart, end: ts })
    segmentStart = ts
  }

  let remaining = duration - segmentStart

  if (remaining > 1) {
    while (remaining > maxClipDuration) {
      points.push({ index: index++, start: segmentStart, end: segmentStart + maxClipDuration })
      segmentStart += maxClipDuration
      remaining -= maxClipDuration
    }
    if (remaining >= minClipDuration || points.length === 0) {
      points.push({ index: index, start: segmentStart, end: duration })
    } else if (points.length > 0) {
      const last = points[points.length - 1]
      points[points.length - 1] = { ...last, end: duration }
    }
  }

  return points
}

export function computeSceneBasedSplitPoints (
  duration: number,
  sceneTimestamps: number[],
  minClipDuration: number = 10,
  maxClipDuration: number = 120
): SplitPoint[] {
  return computeSilenceBasedSplitPoints(duration, sceneTimestamps, minClipDuration, maxClipDuration)
}

export async function splitVideo (
  inputPath: string,
  outputDir: string,
  splitPoints: SplitPoint[],
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<string[]> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const duration = await getVideoDuration(inputPath)
  const total = splitPoints.length
  const outputPaths: string[] = []
  const ext = extname(inputPath) || '.mp4'
  const baseName = basename(inputPath, ext)

  for (let i = 0; i < splitPoints.length; i++) {
    if (signal?.aborted) {
      throw new AppError('Operation cancelled', 'CANCELLED', true)
    }

    const sp = splitPoints[i]
    const segDuration = sp.end - sp.start
    const outputPath = join(outputDir, `${baseName}_clip_${String(sp.index + 1).padStart(3, '0')}${ext}`)

    await runFfmpeg(
      [
        '-ss', String(sp.start),
        '-i', inputPath,
        '-t', String(segDuration),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '22',
        '-y',
        outputPath
      ],
      {
        durationSeconds: duration,
        onProgress: (p) => {
          const segmentPercent = 1 / total
          const overallPercent = (i / total) + (p.percent / 100 * segmentPercent)
          onProgress?.(i + 1, total)
        },
        signal
      }
    )

    outputPaths.push(outputPath)
    onProgress?.(i + 1, total)
  }

  return outputPaths
}
