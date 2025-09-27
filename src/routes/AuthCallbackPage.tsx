import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function parseHashParams(hash: string) {
  if (!hash) return new URLSearchParams()
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
  return new URLSearchParams(trimmed)
}

type Status = 'verifying' | 'success' | 'error'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const errorFromQuery = useMemo(() => {
    if (typeof window === 'undefined') return null
    const searchParams = new URLSearchParams(window.location.search)
    return (
      searchParams.get('error_description') ??
      searchParams.get('error') ??
      searchParams.get('message')
    )
  }, [])

  useEffect(() => {
    let active = true

    let redirectTimeout: ReturnType<typeof setTimeout> | null = null

    const handleCallback = async () => {
      if (errorFromQuery) {
        if (!active) return
        setStatus('error')
        setErrorMessage(errorFromQuery)
        return
      }

      if (typeof window === 'undefined') {
        if (!active) return
        setStatus('error')
        setErrorMessage('Unsupported environment for authentication callback.')
        return
      }

      const hashParams = parseHashParams(window.location.hash)
      const hasTokens = hashParams.has('access_token') && hashParams.has('refresh_token')

      if (!hasTokens) {
        if (!active) return
        setStatus('error')
        setErrorMessage('This magic link is no longer valid. Request a new link to continue.')
        return
      }

      try {
        const { error } = await supabase.auth.getSessionFromUrl({ storeSession: true })
        if (error) {
          throw error
        }

        if (!active) return
        setStatus('success')
        window.history.replaceState({}, document.title, '/auth/callback')
        redirectTimeout = window.setTimeout(() => {
          if (!active) return
          navigate('/new-today', { replace: true })
        }, 600)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'We could not complete sign-in. Request a new magic link and try again.'
        if (!active) return
        setStatus('error')
        setErrorMessage(message)
      }
    }

    void handleCallback()

    return () => {
      active = false
      if (redirectTimeout) {
        window.clearTimeout(redirectTimeout)
      }
    }
  }, [errorFromQuery, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-500">
          Daily Feed
        </p>
        {status === 'verifying' ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Signing you in…</h1>
            <p className="mt-2 text-sm text-slate-600">
              Hang tight while we verify your magic link and prepare your personalised feed.
            </p>
            <div className="mt-6 flex items-center justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            </div>
          </>
        ) : null}

        {status === 'success' ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Welcome back!</h1>
            <p className="mt-2 text-sm text-slate-600">
              You&apos;re signed in. Redirecting to your New Today feed.
            </p>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Link expired</h1>
            <p className="mt-2 text-sm text-rose-600" role="alert">
              {errorMessage ??
                'We could not validate this magic link. Request a new one to continue.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Return to sign-in
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
