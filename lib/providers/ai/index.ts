import { env } from '@/lib/config/env'
import { FallbackProvider } from './fallback'
import { OpenAICompatibleProvider } from './openai-compatible'
import type { AIProvider } from './types'

export function getAIProvider(): AIProvider {
  if (env.AI_PROVIDER === 'openai-compatible' && env.AI_API_KEY) {
    return new OpenAICompatibleProvider()
  }
  return new FallbackProvider()
}

export { parseNaturalQuery } from './fallback'
export type { AIProvider, ChatMessage, ToolCall, ToolDefinition } from './types'
