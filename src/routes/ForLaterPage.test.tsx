import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, it, vi } from 'vitest'
import ForLaterPage from './ForLaterPage'
import * as savedModule from '../api/saved'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    session: { access_token: 'test-token' },
  }),
}))

vi.mock('../api/saved')
vi.mock('../api/save', () => ({
  useSaveToggle: () => ({ toggle: vi.fn(), saving: false }),
}))

const createWrapper =
  (client: QueryClient) =>
  ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )

describe('ForLaterPage', () => {
  const mockedQuery = vi.mocked(savedModule.useSavedItemsQuery)

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders loading skeleton', () => {
    const client = new QueryClient()
    mockedQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof savedModule.useSavedItemsQuery>)

    render(<ForLaterPage />, { wrapper: createWrapper(client) })

    expect(screen.getByTestId('saved-list-loading')).toBeInTheDocument()
  })

  it('renders error state', () => {
    const client = new QueryClient()
    mockedQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof savedModule.useSavedItemsQuery>)

    render(<ForLaterPage />, { wrapper: createWrapper(client) })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders saved items', () => {
    const client = new QueryClient()
    mockedQuery.mockReturnValue({
      data: {
        generatedAt: new Date().toISOString(),
        items: [
          {
            id: 'saved-1',
            title: 'Saved item',
            creator: 'Creator',
            url: 'https://example.com',
            thumbnailUrl: null,
            description: 'Description',
            summary: null,
            timeAgo: '2 hours ago',
            topics: ['topic'],
            isSaved: true,
            savedAt: new Date().toISOString(),
            sourceType: 'news',
          },
        ],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof savedModule.useSavedItemsQuery>)

    render(<ForLaterPage />, { wrapper: createWrapper(client) })

    expect(screen.getByText(/Saved item/i)).toBeInTheDocument()
  })
})
