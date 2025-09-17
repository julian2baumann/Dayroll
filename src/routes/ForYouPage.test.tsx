import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, it, vi } from 'vitest'
import ForYouPage from './ForYouPage'
import * as feedModule from '../api/feed'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    session: { access_token: 'test-token' },
  }),
}))

vi.mock('../api/feed')
vi.mock('../api/save', () => ({
  useSaveToggle: () => ({ toggle: vi.fn(), saving: false }),
}))

const createWrapper =
  (client: QueryClient) =>
  ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )

describe('ForYouPage', () => {
  const mockedQuery = vi.mocked(feedModule.useForYouQuery)

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows skeleton while loading', () => {
    mockedQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof feedModule.useForYouQuery>)

    const client = new QueryClient()
    render(<ForYouPage />, { wrapper: createWrapper(client) })

    expect(screen.getByTestId('for-you-loading')).toBeInTheDocument()
  })

  it('renders error state on failure', () => {
    mockedQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof feedModule.useForYouQuery>)

    const client = new QueryClient()
    render(<ForYouPage />, { wrapper: createWrapper(client) })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows recommendations when data is available', () => {
    mockedQuery.mockReturnValue({
      data: {
        generatedAt: new Date().toISOString(),
        items: [
          {
            id: 'rec-1',
            title: 'Recommendation',
            creator: 'Daily Agent',
            url: 'https://example.com',
            thumbnailUrl: null,
            description: 'Description',
            summary: 'Summary',
            timeAgo: '2 hours ago',
            topics: ['AI'],
            isSaved: false,
            sourceType: 'recommendation',
            sourceId: 'rec',
            durationSeconds: null,
            publishedAt: new Date().toISOString(),
          },
        ],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof feedModule.useForYouQuery>)

    const client = new QueryClient()
    render(<ForYouPage />, { wrapper: createWrapper(client) })

    expect(screen.getByText(/Recommendation/)).toBeInTheDocument()
    expect(screen.getByText(/Refreshed daily/)).toBeInTheDocument()
  })
})
