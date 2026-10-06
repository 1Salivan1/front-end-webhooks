import type { Me, Webhook, WebhookList } from '../api/types'

export const CREDENTIALS = {
  email: 'demo@smartsender.test',
  password: 'Password123!',
} as const

export const USER: Me = {
  id: 1,
  email: CREDENTIALS.email,
  first_name: 'Demo',
  last_name: 'User',
  name: 'Demo User',
}

const WEBHOOK_NAMES = [
  'Order created',
  'Order paid',
  'Order shipped',
  'Order cancelled',
  'Refund issued',
  'Contact subscribed',
  'Contact unsubscribed',
  'Contact updated',
  'Campaign sent',
  'Campaign bounced',
  'Message delivered',
  'Message opened',
  'Message clicked',
  'Message failed',
  'Chat started',
  'Chat closed',
  'Bot handover',
  'Lead captured',
  'Lead qualified',
  'Deal won',
  'Deal lost',
  'Invoice created',
  'Invoice paid',
  'Payment failed',
  'Subscription renewed',
  'Subscription cancelled',
  'Account deleted',
]

function seed(): Webhook[] {
  return WEBHOOK_NAMES.map((name, index) => {
    const id = index + 1
    return {
      id,
      name,
      url: `https://hooks.example.com/${name.toLowerCase().replace(/\s+/g, '-')}`,
      active: id % 4 !== 0,
      // Stable, deterministic timestamps — no Date.now() at module load.
      created_at: new Date(Date.UTC(2026, 0, 1 + index, 9, 0, 0)).toISOString(),
    }
  })
}

let webhooks: Webhook[] = seed()

export function __resetDb(): void {
  webhooks = seed()
}

export interface ListParams {
  page: number
  limit: number
  search: string
}

export function listWebhooks({ page, limit, search }: ListParams): WebhookList {
  const needle = search.trim().toLowerCase()
  const matched = needle
    ? webhooks.filter((webhook) => webhook.name.toLowerCase().includes(needle))
    : webhooks

  const total = matched.length
  const last = Math.max(1, Math.ceil(total / limit))
  const current = Math.min(Math.max(1, page), last)
  const offset = (current - 1) * limit

  return {
    data: matched.slice(offset, offset + limit),
    paging: {
      pages: { current, last },
      results: { total, limitation: limit },
    },
  }
}

export function findWebhook(id: number): Webhook | undefined {
  return webhooks.find((webhook) => webhook.id === id)
}

export type FieldErrors = Record<string, string[]>

export function validateWebhookInput(input: { name: unknown; url: unknown }): FieldErrors | null {
  const errors: FieldErrors = {}

  if (typeof input.name !== 'string' || input.name.trim() === '') {
    errors['name'] = ['The name field is required.']
  }

  if (typeof input.url !== 'string' || input.url.trim() === '') {
    errors['url'] = ['The url field is required.']
  } else if (!isHttpUrl(input.url)) {
    errors['url'] = ['The url must be a valid URL.']
  }

  return Object.keys(errors).length > 0 ? errors : null
}

function isHttpUrl(value: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
}

export function updateWebhook(id: number, input: { name: string; url: string }): Webhook | undefined {
  const index = webhooks.findIndex((webhook) => webhook.id === id)
  const existing = webhooks[index]
  if (existing === undefined) return undefined

  const updated: Webhook = { ...existing, name: input.name.trim(), url: input.url.trim() }
  webhooks[index] = updated
  return updated
}
