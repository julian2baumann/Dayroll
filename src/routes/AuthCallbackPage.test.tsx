import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthCallbackPage from './AuthCallbackPage'

const mockedGetSessionFromUrl = vi.hoisted(() => vi.fn())

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSessionFromUrl: mockedGetSessionFromUrl,
    },
  },
}))

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    mockedGetSessionFromUrl.mockReset()
    window.history.replaceState({}, '', '/auth/callback')
  })

  it('handles successful session exchange', async () => {
    mockedGetSessionFromUrl.mockResolvedValue({ data: { session: {} }, error: null } as never)
    window.history.replaceState(
      {},
      '',
      '/auth/callback#access_token=test-token&refresh_token=refresh-token',
    )

    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Signing you in/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(mockedGetSessionFromUrl).toHaveBeenCalledWith({ storeSession: true })
    })

    await waitFor(() => {
      expect(screen.getByText(/Redirecting to your New Today feed/i)).toBeInTheDocument()
    })
  })

  it('surfaces an error when the link is invalid', async () => {
    mockedGetSessionFromUrl.mockResolvedValue({
      data: { session: null },
      error: new Error('Token expired'),
    } as never)

    window.history.replaceState(
      {},
      '',
      '/auth/callback#access_token=test-token&refresh_token=refresh-token',
    )

    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/token expired/i)
    })
  })
})
