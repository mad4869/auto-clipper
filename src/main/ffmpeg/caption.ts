import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { runFfmpeg } from './ffmpeg'
import {
  type CaptionStyle,
  type WordTiming,
  type SplitPoint,
  DEFAULT_CAPTION_STYLE,
  buildAssSubtitleFile,
  buildSrtFile
} from './filters'
import { AppError } from '../utils/errors'

export interface CaptionJob {
  inputPath: string
  outputDir: string
  words: WordTiming[]
  style: CaptionStyle
  splitPoint?: SplitPoint
  exportSrt?: boolean
  exportAss?: boolean
}

export async function burnCaptions (
  job: CaptionJob,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  let words = job.words
  if (job.splitPoint) {
    const spStart = job.splitPoint.start
    const spEnd = job.splitPoint.end
    words = words
      .filter(w => w.end > spStart && w.start < spEnd)
      .map(w => ({
        ...w,
        start: Math.max(0, w.start - spStart),
        end: Math.max(0, w.end - spStart)
      }))
  }

  if (words.length === 0) {
    throw new AppError('Cannot burn captions: transcript has 0 words for this clip. Please make sure transcription succeeded.', 'NO_WORDS', true)
  }

  const style = { ...DEFAULT_CAPTION_STYLE, ...job.style }
  const ext = extname(job.inputPath) || '.mp4'
  const baseName = basename(job.inputPath, ext)
  const outputPath = join(job.outputDir, `${baseName}_captioned${ext}`)

  if (!existsSync(job.outputDir)) {
    const { mkdirSync } = await import('node:fs')
    mkdirSync(job.outputDir, { recursive: true })
  }

  if (job.exportSrt !== false) {
    const srtPath = join(job.outputDir, `${baseName}.srt`)
    writeFileSync(srtPath, buildSrtFile(words))
  }

  if (job.exportAss !== false) {
    const assPath = join(job.outputDir, `${baseName}.ass`)
    const assContent = buildAssSubtitleFile(words, style)
    writeFileSync(assPath, assContent)
  }

  const assPath = join(job.outputDir, `${baseName}_temp.ass`)
  const assContent = buildAssSubtitleFile(words, style)
  writeFileSync(assPath, assContent)

  // FFmpeg subtitles filter needs forward slashes and escaped colons on Windows
  const assPathForFilter = assPath.replace(/\\/g, '/').replace(/:/g, '\\:')

  try {
    await runFfmpeg(
      [
        '-i', job.inputPath,
        '-vf', `subtitles='${assPathForFilter}'`,
        '-c:v', 'libx264',
        '-c:a', 'copy',
        '-preset', 'fast',
        '-crf', '22',
        '-y',
        outputPath
      ],
      {
        onProgress: (p) => onProgress?.(p.percent),
        signal
      }
    )
  } finally {
    if (existsSync(assPath)) {
      try { unlinkSync(assPath) } catch {}
    }
  }

  return outputPath
}


