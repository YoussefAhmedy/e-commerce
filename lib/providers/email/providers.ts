import { env } from '@/lib/config/env'
import { log } from '@/lib/observability/logger'
import type { EmailMessage, EmailProvider } from './types'

/**
 * Email providers.
 *
 * The console provider is the dev default and has zero dependencies.
 * The SMTP provider wires nodemailer lazily at first use so the rest of the
 * app — and the bundler — never touches the transport stack when email runs
 * in console mode (the default for local dev and CI).
 */

/** Dev default — renders emails into structured logs (nothing is sent). */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console'
  async send(message: EmailMessage): Promise<void> {
    log.info('email (console provider)', {
      to: message.to,
      subject: message.subject,
      preview: message.text.slice(0, 240),
    })
  }
}

interface MailerLike {
  sendMail(input: { from: string; to: string; subject: string; html: string; text: string }): Promise<unknown>
}

/** Production-capable SMTP transport — nodemailer loaded on demand. */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp'
  private transporter: Promise<MailerLike>

  constructor() {
    if (!env.SMTP_HOST) throw new Error('EMAIL_PROVIDER=smtp requires SMTP_HOST')
    this.transporter = (async () => {
      // webpackIgnore: keep nodemailer out of the client/server bundle graph —
      // resolved at runtime against node_modules (CJS entry supports node: schemes fine).
      const nodemailer = await import(/* webpackIgnore: true */ 'nodemailer')
      return nodemailer.createTransport({
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      }) as unknown as MailerLike
    })()
  }

  async send(message: EmailMessage): Promise<void> {
    const transporter = await this.transporter
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
  }
}

export function getEmailProvider(): EmailProvider {
  return env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmailProvider() : new ConsoleEmailProvider()
}
