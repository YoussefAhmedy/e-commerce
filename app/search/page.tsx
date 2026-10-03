import type { Metadata } from 'next'
import { Assistant } from './assistant'

export const metadata: Metadata = {
  title: 'Ask Printique',
  description: 'Chat with the Printique assistant to discover prints and frames using natural language.',
  alternates: { canonical: '/search' },
}

export const dynamic = 'force-dynamic'

export default function SearchAssistantPage() {
  return <Assistant />
}
