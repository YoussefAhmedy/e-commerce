/** Tiny client event bus helpers (cart refresh etc.). Server-safe no-ops. */

export function emitCartChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('pq:cart'))
}

export const dismissToast = null
