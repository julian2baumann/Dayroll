import { FormEvent, useState } from 'react'
import { useAuth } from './context/AuthContext'

const features = [
  {
    title: 'New Today overview',
    body: 'See fresh videos, podcasts, and articles grouped by source every morning with a quick scan.',
  },
  {
    title: 'Source tabs with filters',
    body: 'Dive deeper by channel, show, or publication and filter the last 3 or 7 days without losing context.',
  },
  {
    title: 'Save for Later queue',
    body: 'Keep track of stories you want to follow up on, synced across devices.',
  },
  {
    title: 'For You agent',
    body: 'Daily topic picks with concise summaries that stay under the five-item quota.',
  },
]

function SignedInExperience() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-16 sm:px-8">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
          Daily Feed
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Everything new today, organized for your morning check-in.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Dayroll unifies new drops from YouTube creators, Spotify podcasts, and trusted RSS sources
          into responsive carousels and focused tabs. Configure sources and topics once; start every
          day with a single, fast feed.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 font-medium text-indigo-600 shadow-sm">
            Node · React · Tailwind
          </span>
          <span>p95 initial render target: 1.5s</span>
          <span>Server budget: 500ms p95</span>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">{feature.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{feature.body}</p>
          </article>
        ))}
      </section>

      <footer className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        <p className="font-medium text-slate-900">Tooling status</p>
        <ul className="mt-3 space-y-2">
          <li>✅ ESLint, Prettier, TypeScript, and Husky configured</li>
          <li>✅ Vitest unit testing with Testing Library</li>
          <li>✅ Playwright E2E harness ready for responsive checks</li>
        </ul>
      </footer>
    </main>
  )
}

function SignInForm() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email) return
    setStatus('sending')
    setErrorMessage(null)
    const { error } = await signInWithEmail(email)
    if (error) {
      setStatus('error')
      setErrorMessage(error)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-4 py-16">
      <div className="w-full rounded-2xl border border-indigo-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in to Daily Feed</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email address and we will send you a magic link to access your personalized
          feed.
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
    </div>
  )
}

function App() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-slate-500">
        Checking session…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {user ? (
        <>
          <div className="flex justify-end px-4 pt-6 sm:px-8">
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-indigo-100 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50"
            >
              Sign out
            </button>
          </div>
          <SignedInExperience />
        </>
      ) : (
        <SignInForm />
      )}
    </div>
  )
}

export default App
