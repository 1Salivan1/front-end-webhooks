import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { isApiError, isValidationError } from '../../api/errors'
import type { Webhook } from '../../api/types'
import { applyServerErrors } from '../../lib/applyServerErrors'
import { useUpdateWebhookMutation } from './queries'

/**
 * Deliberately thin: the client only catches empty values, the server stays the
 * single authority on what a valid URL is. Duplicating the format rule here
 * would hide the server's 422 instead of surfacing it next to the field.
 */
const schema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  url: z.string().trim().min(1, 'URL is required.'),
})

type WebhookForm = z.infer<typeof schema>

const FIELDS = ['name', 'url'] as const

interface Props {
  webhook: Webhook | null
  onClose: () => void
}

export function EditWebhookDialog({ webhook, onClose }: Props) {
  const mutation = useUpdateWebhookMutation()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WebhookForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', url: '' },
  })

  // Re-seed the form whenever a different webhook is opened.
  useEffect(() => {
    if (webhook !== null) reset({ name: webhook.name, url: webhook.url })
  }, [webhook, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (webhook === null) return

    try {
      await mutation.mutateAsync({ id: webhook.id, input: values })
      onClose()
    } catch (error) {
      if (isValidationError(error)) {
        applyServerErrors(error.payload, FIELDS, setError)
        return
      }
      setError('root', {
        message: isApiError(error) ? error.message : 'Unable to save the webhook.',
      })
    }
  })

  return (
    <Dialog open={webhook !== null} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle>Edit webhook</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {errors.root?.message !== undefined && (
              <Alert severity="error">{errors.root.message}</Alert>
            )}

            <TextField
              label="Name"
              autoFocus
              error={errors.name !== undefined}
              helperText={errors.name?.message ?? ' '}
              {...register('name')}
            />

            <TextField
              label="URL"
              error={errors.url !== undefined}
              helperText={errors.url?.message ?? ' '}
              {...register('url')}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
