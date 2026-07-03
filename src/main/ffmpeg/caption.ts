import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { runFfmpeg } from './ffmpeg'
import {
  type CaptionStyle,
  type WordTiming,
  type SplitPoint,
  DEFAULT_CAPTION_STYLE,
  buildAnimatedCaptionFilters,
  buildAssSubtitleFile,
  buildSrtFile
} from './filters'
import { AppError, ErrorCodes } from '../utils/errors'

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

  try {
    const wordsPerLine = style.maxWordsPerLine
    const chunks: WordTiming[][] = []
    for (let i = 0; i < words.length; i += wordsPerLine) {
      chunks.push(words.slice(i, i + wordsPerLine))
    }

    const filterParts: string[] = []

    if (style.animation === 'pop' || style.animation === 'fade') {
      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx]
        const chunkStart = chunk[0].start
        const chunkEnd = chunk[chunk.length - 1].end
        const text = chunk.map(w => w.word).join(' ')

        const escapedText = text
          .replace(/'/g, "'\\\\\\''")
          .replace(/%/g, '\\\\%')
          .replace(/:/g, '\\\\:')
          .replace(/\\/g, '\\\\\\\\')

        const y = style.position === 'lower-third'
          ? `(h-text_h)-${style.fontSize + 20}`
          : style.position === 'top'
            ? `${style.fontSize + 10}`
            : `(h-text_h)/2`

        const alpha = style.animation === 'fade'
          ? `:alpha='if(lt(t,${chunkStart}+0.15),(t-${chunkStart})/0.15,if(gt(t,${chunkEnd}-0.15),(${chunkEnd}-t)/0.15,1))'`
          : ''

        filterParts.push(
          `drawtext=text='${escapedText}'` +
          `:fontsize=${style.fontSize}` +
          `:fontcolor=${style.fontColor}@1` +
          `:fontfile='${style.font}'` +
          `:x=(w-text_w)/2` +
          `:y=${y}` +
          `:box=1:boxcolor=black@0.6:boxborderw=6` +
          `:enable='between(t,${chunkStart},${chunkEnd})'` +
          alpha
        )
      }
    } else {
      filterParts.push(`subtitles='${assPath}'`)
    }

    const filterComplex = filterParts.join(',')

    await runFfmpeg(
      [
        '-i', job.inputPath,
        '-vf', filterComplex,
        '-c:v', 'libx264',
        '-c:a', 'aac',
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


