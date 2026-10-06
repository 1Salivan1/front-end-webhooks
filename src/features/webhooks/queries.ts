import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchWebhooks, updateWebhook, type WebhookInput, type WebhookListParams } from '../../api/webhooks'
import type { Webhook, WebhookList } from '../../api/types'

export const webhookKeys = {
  all: ['webhooks'] as const,
  list: (params: WebhookListParams) => ['webhooks', 'list', params] as const,
}

export function useWebhooksQuery(params: WebhookListParams) {
  return useQuery<WebhookList>({
    queryKey: webhookKeys.list(params),
    queryFn: () => fetchWebhooks(params),
    // Retries are the HTTP client's job (CSRF and session rotation); a failure
    // that reaches here is final.
    retry: false,
    placeholderData: keepPreviousData,
  })
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient()

  return useMutation<Webhook, Error, { id: number; input: WebhookInput }>({
    mutationFn: ({ id, input }) => updateWebhook(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: webhookKeys.all })
    },
  })
}
