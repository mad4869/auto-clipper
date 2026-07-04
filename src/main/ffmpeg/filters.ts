export interface DrawtextParams {
  text: string
  fontFile?: string
  fontSize?: number
  fontColor?: string
  x?: string
  y?: string
  box?: boolean
  boxColor?: string
  boxBorderWidth?: number
  enable?: string
  alpha?: string
}

export interface CaptionStyle {
  font: string
  fontSize: number
  fontColor: string
  highlightColor: string
  position: 'lower-third' | 'center' | 'top'
  animation: 'pop' | 'karaoke' | 'fade'
  maxWordsPerLine: number
  showEmojiHighlight: boolean
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  font: 'Arial',
  fontSize: 48,
  fontColor: '#FFFFFF',
  highlightColor: '#FFD700',
  position: 'lower-third',
  animation: 'pop',
  maxWordsPerLine: 4,
  showEmojiHighlight: false
}

function escapeDrawtext (text: string): string {
  return text
    .replace(/'/g, "'\\\\\\''")
    .replace(/%/g, '\\\\%')
    .replace(/:/g, '\\\\:')
    .replace(/\\/g, '\\\\\\\\')
}

export function buildDrawtextFilter (params: DrawtextParams): string {
  const parts: string[] = [
    `text='${escapeDrawtext(params.text)}'`
  ]

  if (params.fontFile) parts.push(`fontfile='${params.fontFile}'`)
  if (params.fontSize) parts.push(`fontsize=${params.fontSize}`)
  if (params.fontColor) parts.push(`fontcolor=${params.fontColor}@1`)
  if (params.x) parts.push(`x=${params.x}`)
  if (params.y) parts.push(`y=${params.y}`)
  if (params.box !== undefined) parts.push(`box=${params.box ? 1 : 0}`)
  if (params.boxColor) parts.push(`boxcolor=${params.boxColor}@0.6`)
  if (params.boxBorderWidth) parts.push(`boxborderw=${params.boxBorderWidth}`)
  if (params.enable) parts.push(`enable='${params.enable}'`)
  if (params.alpha) parts.push(`alpha=${params.alpha}`)

  return `drawtext=${parts.join(':')}`
}

export function buildSplitFilter (startTime: number, duration: number): string[] {
  return [
    '-ss', String(startTime),
    '-i', '__INPUT__',
    '-t', String(duration),
    '-c', 'copy'
  ]
}

export function buildReencodeSplitFilter (startTime: number, duration: number): string[] {
  return [
    '-ss', String(startTime),
    '-i', '__INPUT__',
    '-t', String(duration),
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-preset', 'fast',
    '-crf', '22'
  ]
}

export function buildConcatInput (fileList: string[]): string {
  return fileList.map(f => `file '${f.replace(/'/g, "'\\\\\\''")}'`).join('\n')
}

export function buildSilenceDetectArgs (
  inputPath: string,
  silenceDuration: number = 0.5,
  silenceThreshold: string = '-30dB'
): string[] {
  return [
    '-i', inputPath,
    '-af', `silencedetect=noise=${silenceThreshold}:d=${silenceDuration}`,
    '-f', 'null', '-'
  ]
}

export function buildSceneDetectArgs (inputPath: string, threshold: number = 0.3): string[] {
  return [
    '-i', inputPath,
    '-vf', `scdet=threshold=${threshold}`,
    '-f', 'null', '-'
  ]
}

export function getPositionY (position: CaptionStyle['position']): string {
  switch (position) {
    case 'lower-third':
      return '(h-text_h)-30'
    case 'center':
      return '(h-text_h)/2'
    case 'top':
      return '30'
  }
}

export function getPositionX (): string {
  return '(w-text_w)/2'
}

export interface WordTiming {
  word: string
  start: number
  end: number
}

export function buildAnimatedCaptionFilters (
  words: WordTiming[],
  style: CaptionStyle,
  videoDuration: number,
  lineIndex: number,
  totalLines: number
): string[] {
  const filters: string[] = []
  const baseY = getPositionY(style.position)
  const lineOffset = lineIndex * (style.fontSize + 8)
  const y = totalLines > 1
    ? `(${baseY}) - ${(totalLines - 1 - lineIndex) * (style.fontSize + 8)}`
    : baseY

  const wordsPerLine = style.maxWordsPerLine
  const chunks: WordTiming[][] = []
  for (let i = 0; i < words.length; i += wordsPerLine) {
    chunks.push(words.slice(i, i + wordsPerLine))
  }

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx]
    const chunkStart = chunk[0].start
    const chunkEnd = chunk[chunk.length - 1].end
    const chunkDuration = chunkEnd - chunkStart

    const text = chunk.map(w => w.word).join(' ')

    if (style.animation === 'pop') {
      const enableExpr = `between(t,${chunkStart},${chunkEnd})`
      filters.push(buildDrawtextFilter({
        text,
        fontSize: style.fontSize,
        fontColor: style.fontColor,
        fontFile: style.font,
        x: getPositionX(),
        y,
        box: true,
        boxColor: 'black',
        boxBorderWidth: 4,
        enable: enableExpr
      }))
    } else if (style.animation === 'fade') {
      const fadeIn = 0.15
      const fadeOut = 0.15
      const enableExpr = `between(t,${chunkStart},${chunkEnd})`
      const alpha = `if(lt(t,${chunkStart}+${fadeIn}),(t-${chunkStart})/${fadeIn},if(gt(t,${chunkEnd}-${fadeOut}),(${chunkEnd}-t)/${fadeOut},1))`
      filters.push(buildDrawtextFilter({
        text,
        fontSize: style.fontSize,
        fontColor: style.fontColor,
        fontFile: style.font,
        x: getPositionX(),
        y,
        box: true,
        boxColor: 'black',
        boxBorderWidth: 4,
        enable: enableExpr,
        alpha
      }))
    } else if (style.animation === 'karaoke') {
      for (let wi = 0; wi < chunk.length; wi++) {
        const w = chunk[wi]
        const wDuration = w.end - w.start

        const enableExpr = `between(t,${chunkStart},${chunkEnd})`

        const prefix = chunk.slice(0, wi).map(w => w.word).join(' ')
        const suffix = chunk.slice(wi + 1).map(w => w.word).join(' ')
        const fullPrefix = prefix ? prefix + ' ' : ''
        const fullSuffix = suffix ? ' ' + suffix : ''

        const mainText = `${fullPrefix}\\${w.word}\\${fullSuffix}`
          .replace(/^\\/, '')
          .replace(/\\$/, '')

        const highlightExpr = `between(t,${w.start},${w.end})`

        const colorExpr = `if(${highlightExpr},${style.highlightColor},${style.fontColor})`

        filters.push(buildDrawtextFilter({
          text: mainText,
          fontSize: style.fontSize,
          fontFile: style.font,
          x: getPositionX(),
          y,
          box: true,
          boxColor: 'black',
          boxBorderWidth: 4,
          enable: enableExpr,
          fontColor: colorExpr
        }))
      }
    }
  }

  return filters
}

function hexToAssColor (hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length === 6) {
    const r = clean.slice(0, 2)
    const g = clean.slice(2, 4)
    const b = clean.slice(4, 6)
    return `&H00${b}${g}${r}&`
  }
  return '&H00FFFFFF&'
}

export function buildAssSubtitleFile (
  words: WordTiming[],
  style: CaptionStyle,
  videoWidth: number = 1080,
  videoHeight: number = 1920
): string {
  let alignment = 2
  let marginV = 200
  if (style.position === 'center') {
    alignment = 5
    marginV = 0
  } else if (style.position === 'top') {
    alignment = 8
    marginV = 180
  }

  const lines: string[] = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${videoWidth}`,
    `PlayResY: ${videoHeight}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding`,
    `Style: Default,${style.font},${style.fontSize},${hexToAssColor(style.fontColor)},&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,0,${alignment},40,40,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ]

  const wordsPerLine = style.maxWordsPerLine
  const chunks: WordTiming[][] = []
  for (let i = 0; i < words.length; i += wordsPerLine) {
    chunks.push(words.slice(i, i + wordsPerLine))
  }

  for (const chunk of chunks) {
    const start = chunk[0].start
    const end = chunk[chunk.length - 1].end
    const text = chunk.map(w => w.word).join(' ')

    const startStr = formatAssTime(start)
    const endStr = formatAssTime(end)
    const escapedText = text.replace(/\{/g, '\\{').replace(/\}/g, '\\}')

    lines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${escapedText}`)
  }

  return lines.join('\n')
}

export function buildSrtFile (words: WordTiming[]): string {
  const lines: string[] = []
  let index = 1
  let chunk: WordTiming[] = []
  let chunkStart = 0

  for (let i = 0; i < words.length; i++) {
    if (chunk.length === 0) {
      chunkStart = words[i].start
    }
    chunk.push(words[i])

    const isLast = i === words.length - 1
    const gap = isLast ? 0 : (words[i + 1].start - words[i].end)
    const maxGap = 0.3

    if (gap > maxGap || chunk.length >= 10 || isLast) {
      const startTime = formatSrtTime(chunkStart)
      const endTime = formatSrtTime(chunk[chunk.length - 1].end + 0.1)
      const text = chunk.map(w => w.word).join(' ')

      lines.push(String(index))
      lines.push(`${startTime} --> ${endTime}`)
      lines.push(text)
      lines.push('')

      index++
      chunk = []
    }
  }

  return lines.join('\n')
}

function formatSrtTime (seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function formatAssTime (seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const cs = Math.round((s - Math.floor(s)) * 100)
  const wholeS = Math.floor(s)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(wholeS).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
