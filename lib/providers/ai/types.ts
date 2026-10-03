/**
 * AI abstraction.
 *
 * IAIProvider
 *   ├── OpenAICompatibleProvider — any /v1/chat/completions endpoint (env-configured)
 *   └── FallbackProvider         — deterministic, offline; powers "basic mode"
 *                                   with NO fake LLM theater (clearly labeled in UI)
 *
 * Safety rules enforced in this layer:
 *  - no customer PII ever leaves the process (callers pass catalog facts only)
 *  - output length caps + markdown/URL sanitization
 *  - the assistant may only ground answers in tool results from our backend
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON schema
}

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface AIProvider {
  readonly name: string
  readonly grounded: boolean
  /** One chat turn; returns text and optionally tool calls to execute. */
  chat(input: { messages: ChatMessage[]; tools: ToolDefinition[]; maxTokens: number }): Promise<{ text: string; toolCalls: ToolCall[] }>
  /** One-shot text generation (admin drafts). */
  generate(input: { system: string; prompt: string; maxTokens: number }): Promise<string>
}
