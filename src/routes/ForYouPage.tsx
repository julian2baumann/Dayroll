import { useForYouQuery } from '../api/feed'
import { useSaveToggle } from '../api/save'

export default function ForYouPage() {
  const { data, isLoading, isError, isFetching, refetch } = useForYouQuery(5)
  const items = data?.items ?? []
  const generatedAt = data?.generatedAt ? new Date(data.generatedAt) : null

  if (isLoading) {
    return <ForYouSkeleton />
  }

  if (isError) {
    return <ForYouError onRetry={() => void refetch()} />
  }

  if (items.length === 0) {
    return <ForYouEmptyState />
  }

  return (
    <div className="space-y-6" aria-live={isFetching ? 'polite' : 'off'}>
      <header className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5 text-sm text-indigo-700 shadow-sm">
        <p className="font-semibold">Refreshed daily</p>
        <p className="mt-1">
          We pull up to five highlights based on your topics once per day. Check back tomorrow for a
          fresh set.
        </p>
        {generatedAt ? (
          <p className="mt-2 text-xs text-indigo-500">
            Generated at {generatedAt.toLocaleString()}
          </p>
        ) : null}
      </header>

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <ForYouCard item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ForYouCard({
  item,
}: {
  item: {
    id: string
    title: string
    creator: string | null
    url: string
    summary: string | null
    description: string | null
    timeAgo: string
    topics: string[] | null
    thumbnailUrl: string | null
    isSaved: boolean
  }
}) {
  const { toggle, saving } = useSaveToggle(item.id)

  const handleToggle = () => {
    toggle(!item.isSaved)
  }

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm md:flex-row md:items-start md:gap-6">
      <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 md:h-28 md:w-44">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl text-slate-400">✨</span>
        )}
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{item.creator ?? 'Curated suggestion'}</span>
          <span>·</span>
          <span>{item.timeAgo}</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
        {item.summary ? (
          <p className="text-sm text-slate-600">{item.summary}</p>
        ) : item.description ? (
          <p className="text-sm text-slate-600 line-clamp-3">{item.description}</p>
        ) : null}
        {item.topics && item.topics.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.topics.slice(0, 5).map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Open externally
          </a>
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            aria-pressed={item.isSaved}
            className="inline-flex items-center justify-center rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60"
          >
            {item.isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </article>
  )
}

function ForYouSkeleton() {
  return (
    <div className="space-y-4" data-testid="for-you-loading">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex gap-4 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm"
        >
          <div className="h-28 w-44 animate-pulse rounded-2xl bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ForYouError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
      role="alert"
    >
      <p>We couldn’t load your For You picks. Please try again later.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
      >
        Retry
      </button>
    </div>
  )
}

function ForYouEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">No recommendations yet</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add a few topics in onboarding and check back tomorrow for personalised picks.
      </p>
    </div>
  )
}
