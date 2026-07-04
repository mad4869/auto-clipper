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
  let instructions = 'You are an expert transcript editor and speech-to-text error corrector. Clean up and correct the following video transcript:\n\n'
  instructions += 'Instructions:\n'
  instructions += '1. Correct speech-to-text phonetic misrecognitions, spelling errors, and fragmented words based on language context (e.g., in Indonesian fix words like "Fonis" -> "Vonis", "ast ikan" -> "pastikan", "dapet" -> "dapat"; in English fix obvious phonetic typos).\n'
  instructions += '2. Fix grammar and sentence structure while preserving the natural speaking style and vocabulary.\n'
  if (options.removeFillers) {
    instructions += '3. Remove meaningless filler words and stutters (um, uh, like, you know, eeh, hmm, etc.).\n'
  }
  instructions += '\nReturn ONLY the cleaned and corrected transcript text. Do not include any explanations, notes, or markdown formatting.\n\n'
  return instructions + 'Transcript:\n' + options.transcript
}

export function buildHighlightDetectionPrompt (options: HighlightSuggestionOptions): string {
  const n = options.numberOfHighlights || 5
  const minDur = options.minHighlightDuration || 15
  const maxDur = options.maxHighlightDuration || 60
  return `You are a video editor AI. Analyze the transcript below and find the ${n} most engaging segments suitable for short-form social media clips (TikTok, Reels, YouTube Shorts).

Video duration: ${Math.round(options.duration)} seconds

Transcript:
${options.transcript}

Rules:
- Select exactly ${n} segments
- Each segment must be ${minDur} to ${maxDur} seconds long (endTime - startTime)
- startTime and endTime must be valid seconds within 0 to ${Math.round(options.duration)}
- Focus on: strong hooks, emotional peaks, key insights, surprising facts, or memorable quotes
- Reply with ONLY a valid JSON array, nothing else. No markdown, no explanations.

JSON format:
[{"startTime": 10, "endTime": 45, "reason": "Strong hook that grabs attention"}, ...]`
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
  // Strip markdown code fences if present
  let text = response
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Try direct parse first
  try {
    return JSON.parse(text) as T
  } catch {}

  // Try to extract the first JSON array [...] from the text
  const arrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/)
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]) as T } catch {}
  }

  // Try to extract the first JSON object {...}
  const objectMatch = text.match(/\{[\s\S]*?\}/)
  if (objectMatch) {
    try { return JSON.parse(objectMatch[0]) as T } catch {}
  }

  return null
}
