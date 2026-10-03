import { site } from '@/lib/config/site'
import { formatMoney } from '@/lib/domain/money'

/**
 * Centralized email templates (no HTML strings in controllers).
 * To keep things dependency-free we emit simple, inlined-CSS HTML.
 * A React-Email renderer can replace this module without touching callers.
 */

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#faf8f5;font-family:ui-sans-serif,system-ui,sans-serif;color:#201a17">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin-bottom:24px">${site.name}</div>
    <div style="background:#ffffff;border:1px solid #ece7e1;border-radius:16px;padding:28px">
      <h1 style="font-size:18px;margin:0 0 16px">${title}</h1>
      ${body}
    </div>
    <p style="font-size:12px;color:#8a8178;margin-top:24px">
      ${site.legalName} · <a href="${site.url}" style="color:#b4541f">${site.url}</a>
    </p>
  </div></body></html>`
}

function p(text: string): string {
  return `<p style="font-size:14px;line-height:1.6;margin:0 0 12px">${text}</p>`
}

function cta(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#201a17;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;margin:8px 0">${label}</a>`
}

export interface RenderedTemplate {
  subject: string
  html: string
  text: string
}

export function welcomeEmail(name: string): RenderedTemplate {
  const subject = `Welcome to ${site.name}`
  return {
    subject,
    html: layout(subject, p(`Hi ${escapeHtml(name)},`) + p('Your account is ready. Discover museum-quality prints, or turn your own photos into framed art.') + cta(`${site.url}/catalog`, 'Browse the collection')),
    text: `Welcome to ${site.name}, ${name}! Browse the collection: ${site.url}/catalog`,
  }
}

export function verifyEmailEmail(name: string, verifyUrl: string): RenderedTemplate {
  const subject = `Verify your ${site.name} email`
  return {
    subject,
    html: layout(subject, p(`Hi ${escapeHtml(name)}, confirm this email address to finish setting up your account. The link expires in 24 hours.`) + cta(verifyUrl, 'Verify email')),
    text: `Verify your email: ${verifyUrl}`,
  }
}

export function passwordResetEmail(resetUrl: string): RenderedTemplate {
  const subject = `Reset your ${site.name} password`
  return {
    subject,
    html: layout(subject, p('We received a request to reset your password. This link expires in 1 hour. If you did not request it, you can ignore this email.') + cta(resetUrl, 'Reset password')),
    text: `Reset your password: ${resetUrl}`,
  }
}

export function orderConfirmationEmail(input: {
  name: string
  orderNumber: string
  totalCents: number
  currency: string
  orderUrl: string
  lines: Array<{ name: string; quantity: number; lineTotalCents: number }>
}): RenderedTemplate {
  const subject = `Order ${input.orderNumber} confirmed`
  const lines = input.lines
    .map((l) => `<tr><td style="padding:6px 0;font-size:14px">${escapeHtml(l.name)} × ${l.quantity}</td><td style="text-align:right;font-size:14px">${formatMoney(l.lineTotalCents, input.currency)}</td></tr>`)
    .join('')
  return {
    subject,
    html: layout(subject,
      p(`Thank you, ${escapeHtml(input.name)} — your order is paid and confirmed.`) +
      `<table style="width:100%;border-top:1px solid #ece7e1;border-bottom:1px solid #ece7e1;margin:12px 0">${lines}</table>` +
      p(`<strong>Total: ${formatMoney(input.totalCents, input.currency)}</strong>`) +
      cta(input.orderUrl, 'Track your order')),
    text: `Order ${input.orderNumber} confirmed. Total ${formatMoney(input.totalCents, input.currency)}. ${input.orderUrl}`,
  }
}

export function orderShippedEmail(input: { name: string; orderNumber: string; trackingNumber: string | null; carrier: string | null }): RenderedTemplate {
  const tracking = input.trackingNumber ? ` Tracking: ${input.carrier ?? ''} ${input.trackingNumber}.` : ''
  const subject = `Order ${input.orderNumber} has shipped`
  return {
    subject,
    html: layout(subject, p(`Good news, ${escapeHtml(input.name)} — your order is on its way.${escapeHtml(tracking)}`)),
    text: `Order ${input.orderNumber} has shipped.${tracking}`,
  }
}

export function accountSecurityEmail(name: string, what: string): RenderedTemplate {
  const subject = `Security alert for your ${site.name} account`
  return {
    subject,
    html: layout(subject, p(`Hi ${escapeHtml(name)},`) + p(escapeHtml(what)) + p('If this wasn’t you, reset your password immediately.')),
    text: `${subject}: ${what}`,
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
