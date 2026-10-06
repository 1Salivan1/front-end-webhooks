import { request } from './client'
import type { Webhook, WebhookList } from './types'

export const PAGE_SIZE = 10

export interface WebhookListParams {
  page: number
  search: string
}

export function fetchWebhooks({ page, search }: WebhookListParams): Promise<WebhookList> {
  return request<WebhookList>('/v1/webhooks', {
    searchParams: { page, limit: PAGE_SIZE, search },
  })
}

export function fetchWebhook(id: number): Promise<Webhook> {
  return request<Webhook>(`/v1/webhooks/${id}`)
}

export interface WebhookInput {
  name: string
  url: string
}

export function updateWebhook(id: number, input: WebhookInput): Promise<Webhook> {
  return request<Webhook>(`/v1/webhooks/${id}`, { method: 'PUT', body: input })
}
