import { useEffect, useMemo, useState } from 'react'
import type { FeedListResponse, TodayFeedItem } from '../../api/feed'
import { useFeedListQuery } from '../../api/feed'
import { useSaveToggle } from '../../api/save'

const RANGE_OPTIONS: Array<{ label: string; value: FeedListResponse['range'] }> = [
  { label: 'Last 3 days', value: '3d' },
  { label: 'Last week', value: '7d' },
]

interface SourceListPageProps {
  type: FeedListResponse['type']
  heroTitle: string
  heroDescription: string
}

export function SourceListPage({ type, heroTitle, heroDescription }: SourceListPageProps) {
  const [range, setRange] = useState<FeedListResponse['range']>('3d')
  const { data, isLoading, isError, isFetching, refetch } = useFeedListQuery({
    type,
    range,
    limit: 200,
    offset: 0,
  })

  const sections = data?.sections ?? []

  return (
    <div className="space-y-8" aria-live={isFetching ? 'polite' : 'off'}>
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{heroTitle}</h1>
          <p className="mt-2 text-sm text-slate-600">{heroDescription}</p>
        </div>
        <RangeSelector value={range} onChange={setRange} disabled={isFetching} />
      </header>

      {isLoading ? <ListSkeleton /> : null}
      {isError ? <ListError onRetry={() => void refetch()} /> : null}

      {!isLoading && !isError ? (
        sections.length > 0 ? (
          <div className="space-y-6">
            {sections.map((section, index) => (
              <Section key={section.label} section={section} defaultOpen={index === 0} />
            ))}
          </div>
        ) : (
          <EmptyState type={type} />
        )
      ) : null}
    </div>
  )
}

function RangeSelector({
  value,
  onChange,
  disabled,
}: {
  value: FeedListResponse['range']
  onChange: (value: FeedListResponse['range']) => void
  disabled?: boolean
}) {
  return (
    <div className="inline-flex gap-2 rounded-full border border-slate-200 bg-slate-100/80 p-1 text-xs font-medium text-slate-600">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled || value === option.value}
          className={`rounded-full px-3 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
            value === option.value
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'hover:bg-white/70 disabled:opacity-60'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Section({
  section,
  defaultOpen,
}: {
  section: FeedListResponse['sections'][number]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)

  useEffect(() => {
    setOpen(defaultOpen ?? true)
  }, [section.label, defaultOpen])

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/70 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 md:cursor-default md:border-b md:border-slate-200 md:text-base"
        aria-expanded={open}
      >
        <span>{section.label}</span>
        <span className="md:hidden" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out md:max-h-full md:overflow-visible ${
          open ? 'max-h-[1200px]' : 'max-h-0 md:max-h-full'
        }`}
      >
        <ul className="divide-y divide-slate-200">
          {section.items.map((item) => (
            <li key={item.id} className="px-5 py-4">
              <SourceListItem item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function SourceListItem({ item }: { item: TodayFeedItem }) {
  const { toggle, saving } = useSaveToggle(item.id)

  const handleToggle = () => {
    toggle(!item.isSaved)
  }

  return (
    <article className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
      <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 md:h-24 md:w-40">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl text-slate-400">•</span>
        )}
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{item.creator ?? 'Unknown source'}</span>
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

function ListSkeleton() {
  return (
    <div className="space-y-6" data-testid="source-list-loading">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 2 }).map((__, itemIndex) => (
              <div key={itemIndex} className="flex gap-4">
                <div className="h-24 w-40 animate-pulse rounded-2xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
      role="alert"
    >
      <p>We couldn’t load this section. Please try again in a moment.</p>
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

function EmptyState({ type }: { type: FeedListResponse['type'] }) {
  const copy = useMemo(() => {
    switch (type) {
      case 'podcast':
        return {
          title: 'Add podcasts to start listening',
          description: 'Follow shows from Spotify or RSS to see episodes grouped by day.',
        }
      case 'youtube':
        return {
          title: 'Follow your favourite channels',
          description: 'Add YouTube creators to populate this list with new uploads.',
        }
      case 'news':
      default:
        return {
          title: 'Add news sources to populate this list',
          description: 'Follow RSS feeds to get the latest articles organised by day.',
        }
    }
  }, [type])

  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{copy.title}</h2>
      <p className="mt-2 text-sm text-slate-600">{copy.description}</p>
    </div>
  )
}
