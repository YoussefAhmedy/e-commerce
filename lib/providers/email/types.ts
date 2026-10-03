/**
 * Email abstraction.
 *
 * IEmailProvider
 *   ├── ConsoleEmailProvider — dev default; writes the rendered mail to logs
 *   └── SmtpEmailProvider    — nodemailer SMTP (env-configured)
 *
 * Sending is asynchronous via lib/providers/email/queue.ts:
 * enqueue → email_log row → worker retries with exponential backoff (5 attempts).
 */

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<void>
}
