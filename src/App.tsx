import { FormEvent, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { useAuth } from './context/AuthContext'
import AppLayout from './routes/AppLayout'
import NewTodayPage from './routes/NewTodayPage'
import PodcastsPage from './routes/PodcastsPage'
import YouTubePage from './routes/YouTubePage'
import NewsPage from './routes/NewsPage'
import ForYouPage from './routes/ForYouPage'
import ForLaterPage from './routes/ForLaterPage'
import { OnboardingModal } from './routes/onboarding/OnboardingModal'
import { useSubscriptionsQuery } from './api/subscriptions'

const FEATURES = [
  {
    title: 'Responsive shell',
    body: 'Adaptive bottom navigation on mobile and a desk-friendly sidebar keep primary sections one tap away.',
  },
  {
    title: 'Route scaffolds',
    body: 'Dedicated routes for New Today, Podcasts, YouTube, News, For You, and For Later are ready for data wiring.',
  },
  {
    title: 'Performance ready',
    body: 'Query caching via React Query primes the app for fast, memoised feed fetches.',
  },
  {
    title: 'Accessibility baseline',
    body: 'Skip links, focus styles, and semantics are applied so screen readers can traverse the experience confidently.',
  },
]

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-slate-500">
      Checking session…
    </div>
  )
}

function UnauthenticatedLanding({
  onSignIn,
}: {
  onSignIn: (email: string) => Promise<{ error?: string }>
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email) return
    setStatus('sending')
    setErrorMessage(null)
    const { error } = await onSignIn(email)
    if (error) {
      setStatus('error')
      setErrorMessage(error)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full flex-col justify-center bg-background px-4 py-16">
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2">
          <section className="space-y-6">
            <header className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-500">
                Dayroll
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                Everything new today, beautifully organised.
              </h1>
              <p className="text-base leading-relaxed text-slate-600">
                Connect your YouTube creators, Spotify podcasts, and trusted news feeds once.
                Dayroll brings fresh drops into responsive carousels and focused lists every
                morning.
              </p>
            </header>

            <ul className="grid gap-3">
              {FEATURES.map((feature) => (
                <li
                  key={feature.title}
                  className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"
                >
                  <h2 className="text-sm font-semibold text-indigo-700">{feature.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{feature.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col justify-center">
            <div className="rounded-2xl border border-indigo-100 bg-white/80 p-8 shadow-sm">
              <h2 className="text-2xl font-semibold text-slate-900">Sign in to Daily Feed</h2>
              <p className="mt-2 text-sm text-slate-600">
                Enter your email address to receive a magic link. No passwords, just a fast way back
                to your personalised feed.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />

                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? 'Sending magic link…' : 'Email me a magic link'}
                </button>
              </form>

              {status === 'sent' && (
                <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
                  Magic link sent! Check your inbox to finish signing in.
                </p>
              )}

              {status === 'error' && errorMessage && (
                <p className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
                  {errorMessage}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

interface AuthenticatedAppProps {
  onSignOut: () => Promise<void> | void
  userEmail?: string | null
  userId: string
}

function AuthenticatedApp({ onSignOut, userEmail, userId }: AuthenticatedAppProps) {
  const { data: subscriptions = [], isLoading } = useSubscriptionsQuery()
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(`dayroll:onboarded:${userId}`) === 'true'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(window.localStorage.getItem(`dayroll:onboarded:${userId}`) === 'true')
  }, [userId])

  const shouldAutoOpen = !dismissed && !isLoading && subscriptions.length === 0

  useEffect(() => {
    if (shouldAutoOpen) {
      setOnboardingOpen(true)
    }
  }, [shouldAutoOpen])

  const handleComplete = (result: { topics: string[] }) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`dayroll:onboarded:${userId}`, 'true')
      if (result.topics.length > 0) {
        window.localStorage.setItem(`dayroll:topics:${userId}`, JSON.stringify(result.topics))
      }
    }
    setOnboardingOpen(false)
    setDismissed(true)
  }

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`dayroll:onboarded:${userId}`, 'true')
    }
    setOnboardingOpen(false)
    setDismissed(true)
  }

  const openOnboarding = () => {
    setOnboardingOpen(true)
    setDismissed(false)
  }

  return (
    <>
      <Routes>
        <Route
          element={
            <AppLayout
              onSignOut={onSignOut}
              onRequestOnboarding={openOnboarding}
              userEmail={userEmail}
            />
          }
        >
          <Route index element={<Navigate to="/new-today" replace />} />
          <Route path="new-today" element={<NewTodayPage />} />
          <Route path="podcasts" element={<PodcastsPage />} />
          <Route path="youtube" element={<YouTubePage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="for-you" element={<ForYouPage />} />
          <Route path="for-later" element={<ForLaterPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/new-today" replace />} />
      </Routes>
      <OnboardingModal
        open={onboardingOpen || shouldAutoOpen}
        onClose={handleClose}
        onComplete={handleComplete}
        existingSubscriptions={subscriptions}
      />
    </>
  )
}

function App() {
  const { user, loading, signInWithEmail, signOut } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {user ? (
          <AuthenticatedApp onSignOut={() => signOut()} userEmail={user.email} userId={user.id} />
        ) : (
          <UnauthenticatedLanding onSignIn={signInWithEmail} />
        )}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
