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

function App() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-16 sm:px-8">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
            Daily Feed
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Everything new today, organized for your morning check-in.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Dayroll unifies new drops from YouTube creators, Spotify podcasts, and trusted RSS
            sources into responsive carousels and focused tabs. Configure sources and topics once;
            start every day with a single, fast feed.
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
    </div>
  )
}

export default App
