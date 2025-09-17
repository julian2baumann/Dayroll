import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTodayFeedQuery } from '../api/feed'
import { useSaveToggle } from '../api/save'

const GROUP_ICONS: Record<string, string> = {
  youtube: '▶️',
  podcast: '🎧',
  news: '📰',
  recommendation: '✨',
}

const GROUP_GRADIENTS: Record<string, string> = {
  youtube: 'from-rose-100/70 to-rose-50/40',
  podcast: 'from-indigo-100/70 to-indigo-50/40',
  news: 'from-amber-100/70 to-amber-50/40',
  recommendation: 'from-emerald-100/70 to-emerald-50/40',
}

export default function NewTodayPage() {
  const { data, isLoading, isError, refetch, isFetching } = useTodayFeedQuery()

  const content = useMemo(() => data?.groups ?? [], [data])

  if (isLoading) {
    return <LoadingState />
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />
  }

  return (
    <div className="space-y-12" aria-live={isFetching ? 'polite' : 'off'}>
      {content.map((group) => (
        <CarouselRow key={group.type} group={group} isLoading={isFetching} />
      ))}
      {content.length === 0 ? <EmptyState /> : null}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-12" data-testid="today-feed-loading">
      {Array.from({ length: 3 }).map((_, index) => (
        <section key={index} className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded-full bg-slate-200" />
          <div className="h-4 w-72 animate-pulse rounded-full bg-slate-200" />
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex gap-4">
              {Array.from({ length: 3 }).map((__, idx) => (
                <div
                  key={idx}
                  className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="h-36 w-full animate-pulse rounded-xl bg-slate-200" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
      role="alert"
    >
      <p>We couldn’t load your feed. Check your connection and try again.</p>
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

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-2xl">
        ☀️
      </div>
      <h2 className="mt-6 text-xl font-semibold text-slate-900">
        Add sources to build your morning briefing
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Once you follow YouTube channels, podcasts, or news feeds, we’ll populate your New Today
        carousels within a few minutes.
      </p>
    </div>
  )
}

interface CarouselRowProps {
  group: {
    type: 'youtube' | 'podcast' | 'news' | 'recommendation'
    title: string
    items: Array<{
      id: string
      title: string
      creator: string | null
      url: string
      thumbnailUrl: string | null
      timeAgo: string
      summary: string | null
      description: string | null
      topics: string[] | null
    }>
  }
  isLoading?: boolean
}

function CarouselRow({ group, isLoading = false }: CarouselRowProps) {
  const headingId = useId()
  const subtitleId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const gradient = GROUP_GRADIENTS[group.type] ?? 'from-slate-100/70 to-slate-50/40'

  const updateScrollState = () => {
    const container = containerRef.current
    if (!container) return
    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    updateScrollState()
    const handleResize = () => updateScrollState()
    container.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', handleResize)
    return () => {
      container.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const scrollBy = (direction: 'left' | 'right') => {
    const container = containerRef.current
    if (!container) return
    const delta = direction === 'left' ? -container.clientWidth : container.clientWidth
    container.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600"
            id={headingId}
          >
            <span aria-hidden="true">{GROUP_ICONS[group.type] ?? '☀️'}</span>
            {group.title}
          </h2>
          <p className="text-xs text-slate-500" id={subtitleId}>
            Freshly pulled with strict dedupe and performance budgets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CarouselButton
            direction="left"
            disabled={!canScrollLeft}
            onClick={() => scrollBy('left')}
          />
          <CarouselButton
            direction="right"
            disabled={!canScrollRight}
            onClick={() => scrollBy('right')}
          />
        </div>
      </header>

      <div
        className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r ${gradient} p-4 shadow-sm`}
      >
        <div
          ref={containerRef}
          role="group"
          aria-labelledby={`${headingId} ${subtitleId}`}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
          tabIndex={0}
        >
          {group.items.map((item) => (
            <CarouselCard key={item.id} item={item} highlight={group.type === 'recommendation'} />
          ))}
          {group.items.length === 0 ? <EmptyCarouselMessage /> : null}
        </div>
        {isLoading ? <LoadingOverlay /> : null}
      </div>
    </section>
  )
}

function CarouselCard({
  item,
  highlight,
}: {
  item: {
    id: string
    title: string
    creator: string | null
    url: string
    thumbnailUrl: string | null
    timeAgo: string
    summary: string | null
    description: string | null
    topics: string[] | null
    isSaved: boolean
  }
  highlight: boolean
}) {
  const { toggle, saving } = useSaveToggle(item.id)
  const handleToggle = () => {
    toggle(!item.isSaved)
  }

  return (
    <article className="min-w-[min(75vw,320px)] snap-start rounded-2xl border border-white/40 bg-white/90 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-within:-translate-y-1 focus-within:shadow-lg">
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="h-40 w-full rounded-xl object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-xl bg-slate-100 text-2xl text-slate-400">
          {GROUP_ICONS[item.sourceType] ?? '☀️'}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{item.creator ?? 'Unknown source'}</span>
          <span>{item.timeAgo}</span>
        </div>
        <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{item.title}</h3>
        {highlight && item.summary ? (
          <p className="line-clamp-3 text-sm text-slate-600">{item.summary}</p>
        ) : item.description ? (
          <p className="line-clamp-3 text-sm text-slate-600">{item.description}</p>
        ) : null}
        {item.topics && item.topics.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.topics.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Open
          </a>
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            aria-pressed={item.isSaved}
            className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60"
            aria-label={item.isSaved ? 'Remove from For Later' : 'Save for Later'}
          >
            {item.isSaved ? '★' : '☆'}
          </button>
        </div>
      </div>
    </article>
  )
}

function CarouselButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40"
      aria-label={direction === 'left' ? 'Scroll carousel left' : 'Scroll carousel right'}
    >
      {direction === 'left' ? '←' : '→'}
    </button>
  )
}

function EmptyCarouselMessage() {
  return (
    <div className="flex min-w-[min(75vw,320px)] snap-start flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-500">
      <p>No items yet — add sources and check back soon.</p>
    </div>
  )
}

function LoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl bg-white/60">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
        Loading
        <span className="inline-flex h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
      </div>
    </div>
  )
}
