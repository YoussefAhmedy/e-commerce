import type { AIProvider, ChatMessage, ToolCall, ToolDefinition } from './types'

/**
 * Fallback provider — zero external calls, zero pretense.
 * It parses natural shopping requests into structured catalog filters with
 * a deterministic rule set, and refuses to free-write marketing copy
 * (returns an empty string so the caller renders a clearly-labeled template).
 */
export class FallbackProvider implements AIProvider {
  readonly name = 'fallback'
  readonly grounded = false

  async chat(input: { messages: ChatMessage[]; tools: ToolDefinition[] }): Promise<{ text: string; toolCalls: ToolCall[] }> {
    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return { text: '', toolCalls: [] }
    const tool = input.tools.find((t) => t.name === 'search_catalog')
    if (!tool) return { text: '', toolCalls: [] }
    return { text: '', toolCalls: [{ name: 'search_catalog', arguments: parseNaturalQuery(lastUser.content) as unknown as Record<string, unknown> }] }
  }

  async generate(): Promise<string> {
    return ''
  }
}

export interface ParsedShoppingQuery {
  q: string
  type?: 'POSTER' | 'FRAME'
  color?: string
  material?: string
  maxPriceCents?: number
  minPriceCents?: number
}

const COLORS = ['black', 'white', 'natural', 'oak', 'walnut', 'gold', 'silver', 'blue', 'green', 'red', 'pink', 'grey', 'gray'] as const
const MATERIALS = ['oak', 'walnut', 'metal', 'aluminum', 'wood', 'aluminium'] as const
const STOP = new Set(['a', 'an', 'the', 'me', 'my', 'for', 'of', 'and', 'with', 'under', 'over', 'less', 'than', 'more', 'find', 'show', 'get', 'looking', 'want', 'need', 'please'])

/**
 * "natural oak frame under 80" → { q: '', type: 'FRAME', color: 'natural',
 * material: 'oak', maxPriceCents: 8000 }
 */
export function parseNaturalQuery(input: string): ParsedShoppingQuery {
  const text = input.toLowerCase()
  const out: ParsedShoppingQuery = { q: '' }

  if (/\b(frame|frames|framing|framed)\b/.test(text)) out.type = 'FRAME'
  else if (/\b(poster|posters|print|prints|art|artwork)\b/.test(text)) out.type = 'POSTER'

  for (const c of COLORS) {
    if (new RegExp(`\\b${c}\\b`).test(text)) {
      out.color = c === 'gray' ? 'grey' : c
      break
    }
  }
  for (const m of MATERIALS) {
    if (new RegExp(`\\b${m}\\b`).test(text)) {
      out.material = m === 'aluminium' ? 'aluminum' : m
      break
    }
  }

  const price = text.match(/(?:under|below|less than|max(?:imum)?|up to|<)\s*\$?\s*(\d{1,6})/)
  if (price?.[1]) out.maxPriceCents = Math.round(Number(price[1]) * 100)
  const minPrice = text.match(/(?:over|above|more than|at least|>)\s*\$?\s*(\d{1,6})/)
  if (minPrice?.[1]) out.minPriceCents = Math.round(Number(minPrice[1]) * 100)

  const terms = text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .filter((w) => w !== out.color && w !== out.material)
    .filter((w) => !['frame', 'frames', 'poster', 'posters', 'print', 'prints', 'price', 'dollars', 'usd'].includes(w))
  out.q = terms.join(' ')
  return out
}
