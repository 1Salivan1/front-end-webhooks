import {
  AppBar,
  Box,
  Button,
  Container,
  Pagination,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import type { Webhook } from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { EditWebhookDialog } from './EditWebhookDialog'
import { WebhooksTable } from './WebhooksTable'
import { useWebhooksQuery } from './queries'
import { useListParams } from './useListParams'

const SEARCH_DEBOUNCE_MS = 300

export function WebhooksPage() {
  const { user, signOut } = useAuth()
  const { params, setPage, setSearch, syncPage } = useListParams()
  const [editing, setEditing] = useState<Webhook | null>(null)

  // Local input state keeps typing responsive; the URL is still the source of truth.
  const [searchInput, setSearchInput] = useState(params.search)
  const [syncedSearch, setSyncedSearch] = useState(params.search)

  // The URL changed from the outside (back/forward, reload): adopt it into the
  // field. Adjusting state during render rather than in an effect avoids
  // rendering the stale value first.
  if (syncedSearch !== params.search) {
    setSyncedSearch(params.search)
    setSearchInput(params.search)
  }

  useEffect(() => {
    if (searchInput.trim() === params.search) return

    const timeout = setTimeout(() => {
      setSearch(searchInput)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timeout)
    }
  }, [searchInput, params.search, setSearch])

  const query = useWebhooksQuery(params)
  const paging = query.data?.paging

  // Syncing an external system (the URL) with what the server actually served.
  useEffect(() => {
    if (paging !== undefined) syncPage(paging.pages.current)
  }, [paging, syncPage])

  return (
    <Box>
      <AppBar position="static" color="default" elevation={0} variant="outlined">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            Webhooks
          </Typography>
          {user !== null && (
            <Typography variant="body2" color="text.secondary">
              {user.name}
            </Typography>
          )}
          <Button onClick={() => void signOut()}>Sign out</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <TextField
            label="Search by name"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            size="small"
            sx={{ maxWidth: 360 }}
          />

          <WebhooksTable
            webhooks={query.data?.data ?? []}
            isLoading={query.isPending}
            error={query.error}
            search={params.search}
            onRetry={() => void query.refetch()}
            onEdit={setEditing}
          />

          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {paging === undefined ? ' ' : `${paging.results.total} webhook(s)`}
            </Typography>

            {paging !== undefined && paging.pages.last > 1 && (
              <Pagination
                count={paging.pages.last}
                page={paging.pages.current}
                onChange={(_, page) => setPage(page)}
                color="primary"
              />
            )}
          </Stack>
        </Stack>
      </Container>

      <EditWebhookDialog webhook={editing} onClose={() => setEditing(null)} />
    </Box>
  )
}
