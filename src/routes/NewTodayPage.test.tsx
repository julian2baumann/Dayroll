import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, it, vi } from 'vitest'
import NewTodayPage from './NewTodayPage'
import * as feedModule from '../api/feed'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    session: { access_token: 'test-token' },
    user: { id: 'user-1' },
  }),
}))

vi.mock('../api/feed')

const createWrapper =
  (client: QueryClient) =>
  ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )

describe('NewTodayPage', () => {
  const mockedUseTodayFeedQuery = vi.mocked(feedModule.useTodayFeedQuery)

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows skeleton while loading', () => {
    const queryClient = new QueryClient()
    mockedUseTodayFeedQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof feedModule.useTodayFeedQuery>)

    render(<NewTodayPage />, { wrapper: createWrapper(queryClient) })

    expect(screen.getByTestId('today-feed-loading')).toBeInTheDocument()
  })

  it('renders error state when query fails', () => {
    const queryClient = new QueryClient()
    mockedUseTodayFeedQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof feedModule.useTodayFeedQuery>)

    render(<NewTodayPage />, { wrapper: createWrapper(queryClient) })

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t load your feed/i)
  })

  it('renders carousel rows when data is available', () => {
    const queryClient = new QueryClient()
    mockedUseTodayFeedQuery.mockReturnValue({
      data: {
        generatedAt: new Date().toISOString(),
        groups: [
          {
            type: 'youtube',
            title: 'YouTube',
            items: [
              {
                id: '1',
                sourceType: 'youtube',
                sourceId: 'UC123',
                title: 'Example video',
                creator: 'Creator',
                url: 'https://example.com',
                thumbnailUrl: null,
                description: 'Description',
                summary: null,
                topics: null,
                durationSeconds: null,
                publishedAt: new Date().toISOString(),
                timeAgo: '2 hours ago',
                isSaved: false,
              },
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof feedModule.useTodayFeedQuery>)

    render(<NewTodayPage />, { wrapper: createWrapper(queryClient) })

    expect(screen.getByRole('heading', { name: /YouTube/i })).toBeInTheDocument()
    expect(screen.getByText(/Example video/i)).toBeInTheDocument()
  })
})
