export interface CleanTranscriptOptions {
  transcript: string
  removeFillers?: boolean
  fixGrammar?: boolean
  preservePunctuation?: boolean
}

export interface HighlightSuggestionOptions {
  transcript: string
  duration: number
  numberOfHighlights?: number
  minHighlightDuration?: number
  maxHighlightDuration?: number
}

export interface TitleGenerationOptions {
  transcript: string
  context?: string
}

export function buildCleanTranscriptPrompt (options: CleanTranscriptOptions): string {
  let instructions = 'Clean up the following transcript by:\n'

  if (options.removeFillers) {
    instructions += '- Removing filler words (um, uh, like, you know, etc.)\n'
  }
  if (options.fixGrammar) {
    instructions += '- Fixing obvious grammatical errors\n'
  }
  if (options.preservePunctuation) {
    instructions += '- Preserve original punctuation and capitalization\n'
  }

  instructions += '\nReturn ONLY the cleaned transcript, no explanations or notes.\n\n'

  return instructions + options.transcript
}

export function buildHighlightDetectionPrompt (options: HighlightSuggestionOptions): string {
  return `You are analyzing a video transcript to find the most engaging segments for short-form content (TikTok/Reels/Shorts).

Transcript:
${options.transcript}

Video duration: ${Math.round(options.duration)} seconds

Requirements:
- Find ${options.numberOfHighlightSites || 5} highlight segments
- Each segment should be ${options.minHighlightDuration || 15}-${options.maxHighlightDuration || 60} seconds long
- Look for: emotional moments, key insights, surprising statements, call-to-actions, hooks
- Return as JSON array with objects: { "startTime": <seconds>, "endTime": <seconds>, "reason": "<why this is engaging>" }
- ONLY return the JSON array, no other text`
}

export function buildTitleGenerationPrompt (options: TitleGenerationOptions): string {
  return `Generate 5 engaging titles and hooks for a short-form video based on this transcript.

Transcript:
${options.transcript}

${options.context ? `Context: ${options.context}\n` : ''}
For each title, suggest a hook sentence that could open the video.

Return as JSON array with objects: { "title": "<title>", "hook": "<opening hook sentence>" }
ONLY return the JSON array, no other text.`
}

export function parseJsonResponse<T> (response: string): T | null {
  try {
    const cleaned = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}
