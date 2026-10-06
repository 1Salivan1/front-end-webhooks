import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface ListParams {
  page: number
  search: string
}

function parsePage(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

/**
 * The URL is the single source of truth for the list: reloads and back/forward
 * navigation restore the exact same view.
 */
export function useListParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = useMemo<ListParams>(
    () => ({
      page: parsePage(searchParams.get('page')),
      search: searchParams.get('search')?.trim() ?? '',
    }),
    [searchParams],
  )

  const write = useCallback(
    (next: ListParams, options: { replace?: boolean } = {}) => {
      const query = new URLSearchParams()
      if (next.search !== '') query.set('search', next.search)
      if (next.page > 1) query.set('page', String(next.page))
      // Push by default: a settled search term is its own history entry.
      setSearchParams(query, { replace: options.replace ?? false })
    },
    [setSearchParams],
  )

  const setPage = useCallback(
    (page: number) => {
      write({ ...params, page })
    },
    [params, write],
  )

  /**
   * The server clamps an out-of-range page. Rewrite the URL to what was actually
   * served, replacing the entry so the bogus page never sits in the history.
   */
  const syncPage = useCallback(
    (page: number) => {
      if (page !== params.page) write({ ...params, page }, { replace: true })
    },
    [params, write],
  )

  /** Changing the search always returns to the first page. */
  const setSearch = useCallback(
    (search: string) => {
      write({ page: 1, search: search.trim() })
    },
    [write],
  )

  return { params, setPage, setSearch, syncPage }
}
