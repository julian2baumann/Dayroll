import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './config'

interface AppLayoutProps {
  onSignOut: () => Promise<void> | void
  onRequestOnboarding: () => void
  userEmail?: string | null
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function AppLayout({ onSignOut, onRequestOnboarding, userEmail }: AppLayoutProps) {
  const location = useLocation()
  const activeNav =
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.path)) ?? NAV_ITEMS[0]

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col md:flex-row">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white/90 px-6 py-8 md:flex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-500">
              Dayroll
            </p>
            <h1 className="mt-3 text-lg font-semibold text-slate-900">Daily Feed</h1>
            <p className="mt-2 text-sm text-slate-500">
              Your morning briefing across videos, podcasts, and articles.
            </p>
          </div>

          <nav aria-label="Primary" className="mt-8 space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  classNames(
                    'flex items-center gap-3 rounded-xl px-3 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500',
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                <span aria-hidden="true" className="text-lg">
                  {item.icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">{item.label}</span>
                  <span className="text-xs leading-snug text-slate-500">{item.description}</span>
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 pt-6 text-sm text-slate-500">
            {userEmail ? (
              <span className="truncate" aria-live="polite">
                Signed in as {userEmail}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onRequestOnboarding}
              className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Add sources
            </button>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex flex-col gap-2 px-4 py-4 sm:px-6 md:px-8 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-500">
                  Daily Feed
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">{activeNav.label}</h2>
                <p className="mt-1 text-sm text-slate-500 md:max-w-xl">{activeNav.description}</p>
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={onRequestOnboarding}
                  className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  Add sources
                </button>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 md:hidden"
                >
                  Sign out
                </button>
              </div>
            </div>
          </header>

          <main id="main-content" className="pb-28 pt-6 md:pb-10 md:pt-8">
            <div className="px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  )
}

function MobileBottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-3 gap-1 px-2 py-2 sm:grid-cols-6">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                classNames(
                  'flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <span aria-hidden="true" className="text-base">
                {item.icon}
              </span>
              <span className="hidden sm:block">{item.label}</span>
              <span className="sm:hidden">{item.label.split(' ')[0]}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default AppLayout
