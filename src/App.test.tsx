import { render, screen } from '@testing-library/react'
import type { Session, User } from '@supabase/supabase-js'
import { vi } from 'vitest'
import App from './App'
import { useAuth } from './context/AuthContext'

vi.mock('./context/AuthContext')

const mockUseAuth = vi.mocked(useAuth)

describe('App', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  const authValue = (overrides: Partial<ReturnType<typeof useAuth>>) => ({
    user: null,
    session: null,
    loading: false,
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  })

  it('renders the main experience when authenticated', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    } as unknown as User
    mockUseAuth.mockReturnValue(
      authValue({
        user,
        session: {} as Session,
      }),
    )

    render(<App />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /everything new today/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Playwright|Vitest|ESLint/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows the sign-in form when no user is present', () => {
    mockUseAuth.mockReturnValue(authValue({ user: null, session: null }))

    render(<App />)

    expect(screen.getByText(/Sign in to Daily Feed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Work email/i)).toBeInTheDocument()
  })
})
