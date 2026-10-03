import { getEmailProvider } from './providers'
import * as repo from '@/lib/db/repositories/engagement'
import { log } from '@/lib/observability/logger'
import type { RenderedTemplate } from './templates'
import * as templates from './templates'

/**
 * Email queue — persisted in email_log (survives restarts), processed
 * asynchronously with exponential backoff (max 5 attempts).
 *
 * delivery logging + failure handling live here; the worker is started in
 * instrumentation.ts. Swap this module for BullMQ/SQS when the deployment
 * grows a separate worker process — call-sites only use enqueueTemplatedEmail.
 */

export type EmailTemplateName =
  | 'WELCOME'
  | 'VERIFY_EMAIL'
  | 'PASSWORD_RESET'
  | 'ORDER_CONFIRMATION'
  | 'ORDER_SHIPPED'
  | 'ACCOUNT_SECURITY'

function render(template: EmailTemplateName, payload: Record<string, unknown>): RenderedTemplate {
  switch (template) {
    case 'WELCOME':
      return templates.welcomeEmail(String(payload.name))
    case 'VERIFY_EMAIL':
      return templates.verifyEmailEmail(String(payload.name), String(payload.verifyUrl))
    case 'PASSWORD_RESET':
      return templates.passwordResetEmail(String(payload.resetUrl))
    case 'ORDER_CONFIRMATION':
      return templates.orderConfirmationEmail(payload as never)
    case 'ORDER_SHIPPED':
      return templates.orderShippedEmail(payload as never)
    case 'ACCOUNT_SECURITY':
      return templates.accountSecurityEmail(String(payload.name), String(payload.what))
  }
}

export function enqueueTemplatedEmail(to: string, template: EmailTemplateName, payload: Record<string, unknown>): string {
  const rendered = render(template, payload)
  const id = repo.enqueueEmail({ to, template, subject: rendered.subject, payload })
  // Opportunistic immediate attempt; the interval worker handles retries.
  setImmediate(() => void processEmailQueue(1).catch(() => undefined))
  return id
}

export async function processEmailQueue(limit = 10): Promise<{ sent: number; failed: number }> {
  const provider = getEmailProvider()
  const batch = repo.nextQueuedEmails(limit)
  let sent = 0
  let failed = 0
  for (const mail of batch) {
    try {
      const rendered = render(mail.template as EmailTemplateName, JSON.parse(mail.payload))
      await provider.send({ to: mail.to, subject: rendered.subject, html: rendered.html, text: rendered.text })
      repo.markEmailSent(mail.id)
      sent++
    } catch (err) {
      failed++
      log.warn('email delivery attempt failed', {
        emailId: mail.id,
        error: err instanceof Error ? err.message : String(err),
      })
      repo.markEmailFailed(mail.id, err instanceof Error ? err.message : String(err), mail.attempts)
    }
  }
  return { sent, failed }
}

let started = false

/** Idempotent worker bootstrap (called from instrumentation.register()). */
export function startEmailWorker(): void {
  if (started) return
  started = true
  const timer = setInterval(() => {
    void processEmailQueue().catch((err) => log.error('email worker error', { error: String(err) }))
  }, 15_000)
  // Never keep the process alive just for mail.
  if (typeof timer.unref === 'function') timer.unref()
}
