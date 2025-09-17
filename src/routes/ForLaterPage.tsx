import { useSavedItemsQuery } from '../api/saved'
import { useSaveToggle } from '../api/save'

export default function ForLaterPage() {
  const { data, isLoading, isError, isFetching, refetch } = useSavedItemsQuery()
  const items = data?.items ?? []

  if (isLoading) {
    return <SavedListSkeleton />
  }

  if (isError) {
    return <SavedListError onRetry={() => void refetch()} />
  }

  if (items.length === 0) {
    return <SavedEmptyState />
  }

  return (
    <div className="space-y-4" aria-live={isFetching ? 'polite' : 'off'}>
      <p className="text-sm text-slate-500">
        Items stay here until you remove them. The latest saves appear first.
      </p>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <SavedItemCard item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SavedItemCard({
  item,
}: {
  item: {
    id: string
    title: string
    creator: string | null
    url: string
    thumbnailUrl: string | null
    description: string | null
    summary: string | null
    timeAgo: string
    topics: string[] | null
    isSaved: boolean
    savedAt: string
  }
}) {
  const { toggle, saving } = useSaveToggle(item.id)

  const handleRemove = () => {
    toggle(false)
  }

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm md:flex-row md:items-start md:gap-6">
      <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 md:h-28 md:w-48">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl text-slate-400">📌</span>
        )}
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{item.creator ?? 'Unknown source'}</span>
          <span>·</span>
          <span>Saved {new Date(item.savedAt).toLocaleString()}</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
        {item.summary ? (
          <p className="text-sm text-slate-600">{item.summary}</p>
        ) : item.description ? (
          <p className="text-sm text-slate-600 line-clamp-3">{item.description}</p>
        ) : null}
        {item.topics && item.topics.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.topics.slice(0, 4).map((topic) => (
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
            onClick={handleRemove}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 shadow-sm transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  )
}

function SavedListSkeleton() {
  return (
    <div className="space-y-4" data-testid="saved-list-loading">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex gap-4 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm"
        >
          <div className="h-28 w-48 animate-pulse rounded-2xl bg-slate-200" />
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

function SavedListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
      role="alert"
    >
      <p>We couldn’t load your saved items. Please try again shortly.</p>
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

function SavedEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Nothing saved yet</h2>
      <p className="mt-2 text-sm text-slate-600">
        Tap the star on any card in New Today or the source tabs to collect links here for later.
      </p>
    </div>
  )
}
