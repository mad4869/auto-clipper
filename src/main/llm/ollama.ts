import { createServer } from 'node:http'
import { request } from 'node:http'
import { AppError, ErrorCodes } from '../utils/errors'

export interface OllamaModel {
  name: string
  modifiedAt: string
  size: number
}

export interface OllamaGenerateOptions {
  model: string
  prompt: string
  system?: string
  temperature?: number
  maxTokens?: number
  onToken?: (token: string) => void
  signal?: AbortSignal
}

const OLLAMA_DEFAULT_HOST = 'http://127.0.0.1:11434'

function getBaseUrl (): string {
  return process.env.OLLAMA_HOST || OLLAMA_DEFAULT_HOST
}

export async function checkOllamaRunning (): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    })
    return res.ok
  } catch {
    return false
  }
}

export async function listOllamaModels (): Promise<OllamaModel[]> {
  const res = await fetch(`${getBaseUrl()}/api/tags`)
  if (!res.ok) {
    throw new AppError(
      'Failed to list Ollama models',
      ErrorCodes.OLLAMA_NOT_RUNNING,
      true
    )
  }

  const data = await res.json() as { models?: { name: string; modified_at: string; size: number }[] }
  return (data.models || []).map(m => ({
    name: m.name,
    modifiedAt: m.modified_at,
    size: m.size
  }))
}

export async function generateText (options: OllamaGenerateOptions): Promise<string> {
  const baseUrl = getBaseUrl()
  const payload = {
    model: options.model,
    prompt: options.prompt,
    system: options.system || '',
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 4096
    }
  }

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal
  })

  if (!res.ok) {
    const text = await res.text()
    if (res.status === 404) {
      throw new AppError(
        `Model '${options.model}' not found in Ollama. Pull it with: ollama pull ${options.model}`,
        ErrorCodes.OLLAMA_MODEL_NOT_FOUND,
        true
      )
    }
    throw new AppError(
      `Ollama generate failed: ${text}`,
      ErrorCodes.UNKNOWN,
      true
    )
  }

  const data = await res.json() as { response?: string }
  return data.response || ''
}

export async function* generateTextStream (options: OllamaGenerateOptions): AsyncGenerator<string> {
  const baseUrl = getBaseUrl()
  const payload = {
    model: options.model,
    prompt: options.prompt,
    system: options.system || '',
    stream: true,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 4096
    }
  }

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal
  })

  if (!res.ok) {
    const text = await res.text()
    if (res.status === 404) {
      throw new AppError(
        `Model '${options.model}' not found in Ollama. Pull it with: ollama pull ${options.model}`,
        ErrorCodes.OLLAMA_MODEL_NOT_FOUND,
        true
      )
    }
    throw new AppError(
      `Ollama generate failed: ${text}`,
      ErrorCodes.UNKNOWN,
      true
    )
  }

  const reader = res.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const data = JSON.parse(line) as { response?: string; done?: boolean }
        if (data.response) {
          yield data.response
        }
      } catch {}
    }
  }
}
