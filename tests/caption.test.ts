import { describe, it, expect } from 'vitest'
import {
  buildDrawtextFilter,
  buildAssSubtitleFile,
  buildSrtFile,
  DEFAULT_CAPTION_STYLE,
  getPositionY,
  getPositionX
} from '../src/main/ffmpeg/filters'

describe('buildDrawtextFilter', () => {
  it('builds basic drawtext filter', () => {
    const filter = buildDrawtextFilter({ text: 'Hello', fontSize: 28, fontColor: '#FFFFFF' })
    expect(filter).toContain('drawtext=')
    expect(filter).toContain("text='Hello'")
    expect(filter).toContain('fontsize=28')
  })

  it('escapes special characters in text', () => {
    const filter = buildDrawtextFilter({ text: "It's a test", fontSize: 20 })
    expect(filter).toContain("text='")
    expect(filter).not.toContain("text='It's")
  })

  it('includes box params when specified', () => {
    const filter = buildDrawtextFilter({
      text: 'Test',
      box: true,
      boxColor: 'black',
      boxBorderWidth: 4
    })
    expect(filter).toContain('box=1')
    expect(filter).toContain('boxcolor=black')
    expect(filter).toContain('boxborderw=4')
  })

  it('includes enable expression when provided', () => {
    const filter = buildDrawtextFilter({
      text: 'Test',
      enable: "between(t,10,20)"
    })
    expect(filter).toContain("enable='between(t,10,20)'")
  })

  it('includes alpha when provided', () => {
    const filter = buildDrawtextFilter({
      text: 'Test',
      alpha: '0.5'
    })
    expect(filter).toContain('alpha=0.5')
  })
})

describe('buildSrtFile', () => {
  it('generates valid SRT format', () => {
    const words = [
      { word: 'Hello', start: 0.5, end: 0.8 },
      { word: 'world', start: 0.9, end: 1.2 },
      { word: 'this', start: 2.0, end: 2.3 },
      { word: 'is', start: 2.3, end: 2.5 },
      { word: 'a', start: 2.5, end: 2.6 },
      { word: 'test', start: 2.6, end: 3.0 }
    ]

    const srt = buildSrtFile(words)
    expect(srt).toContain('1')
    expect(srt).toContain('-->')
    expect(srt).toContain('Hello world')
    expect(srt).toContain('this is a test')
  })

  it('handles single word', () => {
    const words = [{ word: 'Hello', start: 0.5, end: 0.8 }]
    const srt = buildSrtFile(words)
    expect(srt).toContain('Hello')
    expect(srt).toContain('00:00:00,500 --> 00:00:00,900')
  })

  it('groups words by gaps > 0.3s', () => {
    const words = [
      { word: 'First', start: 0, end: 0.5 },
      { word: 'Second', start: 2.0, end: 2.5 }
    ]
    const srt = buildSrtFile(words)
    expect(srt).toContain('First')
    expect(srt).toContain('Second')
    const lines = srt.split('\n')
    expect(lines.filter(l => l.includes('-->'))).toHaveLength(2)
  })
})

describe('buildAssSubtitleFile', () => {
  it('generates valid ASS format with headers', () => {
    const words = [
      { word: 'Hello', start: 0.5, end: 0.8 },
      { word: 'world', start: 0.9, end: 1.2 }
    ]

    const ass = buildAssSubtitleFile(words, DEFAULT_CAPTION_STYLE)
    expect(ass).toContain('[Script Info]')
    expect(ass).toContain('[V4+ Styles]')
    expect(ass).toContain('[Events]')
    expect(ass).toContain('Dialogue:')
    expect(ass).toContain('Hello world')
  })

  it('formats timestamps correctly', () => {
    const words = [
      { word: 'Test', start: 65.5, end: 66.0 }
    ]

    const ass = buildAssSubtitleFile(words, DEFAULT_CAPTION_STYLE)
    expect(ass).toContain('00:01:05.50')
  })

  it('chunks words by maxWordsPerLine', () => {
    const words = Array.from({ length: 10 }, (_, i) => ({
      word: `word${i}`,
      start: i * 0.5,
      end: i * 0.5 + 0.3
    }))

    const ass = buildAssSubtitleFile(words, { ...DEFAULT_CAPTION_STYLE, maxWordsPerLine: 3 })
    const dialogueLines = ass.split('\n').filter(l => l.startsWith('Dialogue:'))
    expect(dialogueLines.length).toBe(4)
  })
})

describe('getPositionY', () => {
  it('returns lower-third position', () => {
    expect(getPositionY('lower-third')).toBe('(h-text_h)-30')
  })

  it('returns center position', () => {
    expect(getPositionY('center')).toBe('(h-text_h)/2')
  })

  it('returns top position', () => {
    expect(getPositionY('top')).toBe('30')
  })
})

describe('getPositionX', () => {
  it('returns centered position', () => {
    expect(getPositionX()).toBe('(w-text_w)/2')
  })
})
