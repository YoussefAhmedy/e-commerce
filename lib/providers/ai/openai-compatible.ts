import { env } from '@/lib/config/env'
import { AppError } from '@/lib/domain/errors'
import type { AIProvider, ChatMessage, ToolCall, ToolDefinition } from './types'

/**
 * OpenAI-compatible chat/completions provider (works with OpenAI, Azure
 * OpenAI-compatible proxies, OpenRouter, local Ollama in OpenAI mode, etc.).
 * The API key never touches the client — this module is server-only.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name = 'openai-compatible'
  readonly grounded = true

  chat = this.complete.bind(this)

  async complete(input: {
    messages: ChatMessage[]
    tools: ToolDefinition[]
    maxTokens: number
  }): Promise<{ text: string; toolCalls: ToolCall[] }> {
    if (!env.AI_API_KEY) throw new AppError('INTERNAL', 'AI provider selected but AI_API_KEY is missing.')

    const body = {
      model: env.AI_MODEL,
      max_tokens: Math.min(input.maxTokens, 800),
      temperature: 0.3,
      messages: input.messages.map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, tool_call_id: m.toolCallId, content: m.content }
        }
        return { role: m.role, content: m.content }
      }),
      ...(input.tools.length > 0
        ? {
            tools: input.tools.map((t) => ({
              type: 'function',
              function: { name: t.name, description: t.description, parameters: t.parameters },
            })),
          }
        : {}),
    }

    let res: Response
    try {
      res = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      })
    } catch (err) {
      throw new AppError('INTERNAL', 'The assistant is temporarily unavailable. Please try again.', {
        cause: String(err),
      })
    }
    if (!res.ok) {
      throw new AppError('INTERNAL', `AI provider error (${res.status}).`)
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null
          tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>
        }
      }>
    }
    const message = json.choices?.[0]?.message
    const toolCalls: ToolCall[] = (message?.tool_calls ?? [])
      .map((tc) => {
        let args: Record<string, unknown> = {}
        try {
          args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}
        } catch {
          args = {}
        }
        return { name: String(tc.function?.name ?? ''), arguments: args }
      })
      .filter((tc) => tc.name)

    return { text: (message?.content ?? '').trim(), toolCalls }
  }

  async generate(input: { system: string; prompt: string; maxTokens: number }): Promise<string> {
    const result = await this.complete({
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.prompt },
      ],
      tools: [],
      maxTokens: input.maxTokens,
    })
    return result.text
  }
}
