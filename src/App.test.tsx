import { render, screen, waitFor } from '@testing-library/react'
import type { Session, User } from '@supabase/supabase-js'
import { vi } from 'vitest'
import App from './App'
import { useAuth } from './context/AuthContext'

vi.mock('./context/AuthContext')

const mockUseAuth = vi.mocked(useAuth)

describe('App', () => {
  const createResponse = (data: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })

  beforeEach(() => {
    mockUseAuth.mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createResponse([])))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const authValue = (overrides: Partial<ReturnType<typeof useAuth>>) => ({
    user: null,
    session: null,
    loading: false,
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  })

  it('renders the application shell when authenticated', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User
    mockUseAuth.mockReturnValue(
      authValue({
        user,
        session: { access_token: 'test-token' } as Session,
      }),
    )

    vi.mocked(fetch).mockResolvedValueOnce(
      createResponse([
        {
          id: 'sub-1',
          userId: user.id,
          sourceType: 'youtube',
          sourceId: 'UC123',
          sourceName: 'Example Channel',
          metadata: null,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ]),
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      createResponse({ generatedAt: new Date().toISOString(), groups: [] }),
    )

    render(<App />)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: /New Today/i,
        }),
      ).toBeInTheDocument(),
    )

    expect(screen.getAllByRole('navigation', { name: /Primary/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Sign out/i).length).toBeGreaterThan(0)
  })

  it('shows the sign-in form when no user is present', () => {
    mockUseAuth.mockReturnValue(authValue({ user: null, session: null }))

    render(<App />)

    expect(screen.getByText(/Sign in to Daily Feed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Work email/i)).toBeInTheDocument()
  })
})
