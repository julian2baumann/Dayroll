interface PlaceholderGroupProps {
  title: string
  description: string
  items: string[]
  layout?: 'grid' | 'list'
}

export function PlaceholderGroup({
  title,
  description,
  items,
  layout = 'grid',
}: PlaceholderGroupProps) {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </header>
      <div className={layout === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
        {items.map((item) => (
          <article
            key={item}
            className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-4 shadow-sm"
            aria-label={`${item} placeholder`}
          >
            <p className="text-sm font-medium text-slate-600">{item}</p>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ComingSoonNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-700 shadow-sm">
      {children}
    </div>
  )
}
