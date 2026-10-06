import {
  Alert,
  Button,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { Webhook } from '../../api/types'
import { PAGE_SIZE } from '../../api/webhooks'

interface Props {
  webhooks: Webhook[]
  isLoading: boolean
  error: Error | null
  search: string
  onRetry: () => void
  onEdit: (webhook: Webhook) => void
}

export function WebhooksTable({ webhooks, isLoading, error, search, onRetry, onEdit }: Props) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>URL</TableCell>
            <TableCell>Active</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {error !== null ? (
            <StateRow>
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={onRetry}>
                    Retry
                  </Button>
                }
              >
                {error.message}
              </Alert>
            </StateRow>
          ) : isLoading ? (
            <LoadingRows />
          ) : webhooks.length === 0 ? (
            <StateRow>
              <Stack spacing={0.5} sx={{ py: 3, alignItems: 'center' }}>
                <Typography color="text.secondary">
                  {search === '' ? 'No webhooks yet.' : `Nothing matches “${search}”.`}
                </Typography>
                {search !== '' && (
                  <Typography variant="body2" color="text.secondary">
                    Try a different name.
                  </Typography>
                )}
              </Stack>
            </StateRow>
          ) : (
            webhooks.map((webhook) => (
              <TableRow key={webhook.id} hover>
                <TableCell>{webhook.name}</TableCell>
                <TableCell sx={{ wordBreak: 'break-all' }}>{webhook.url}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={webhook.active ? 'Active' : 'Inactive'}
                    color={webhook.active ? 'success' : 'default'}
                    variant={webhook.active ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => onEdit(webhook)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function StateRow({ children }: { children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={4}>{children}</TableCell>
    </TableRow>
  )
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }, (_, index) => (
        <TableRow key={index}>
          <TableCell colSpan={4}>
            <Skeleton height={28} />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
