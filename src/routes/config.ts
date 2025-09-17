export interface NavItem {
  id: string
  label: string
  description: string
  path: string
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'new-today',
    label: 'New Today',
    description: 'Four responsive carousels for podcasts, videos, news, and For You.',
    path: '/new-today',
    icon: '☀️',
  },
  {
    id: 'podcasts',
    label: 'Podcasts',
    description: 'Latest podcast episodes grouped by day with quick range filters.',
    path: '/podcasts',
    icon: '🎧',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    description: 'Channel uploads with section headers and carousel hand-off.',
    path: '/youtube',
    icon: '▶️',
  },
  {
    id: 'news',
    label: 'News',
    description: 'High-density article list with Listen support when available.',
    path: '/news',
    icon: '📰',
  },
  {
    id: 'for-you',
    label: 'For You',
    description: 'Daily topic picks with summaries and refresh cadence metadata.',
    path: '/for-you',
    icon: '✨',
  },
  {
    id: 'for-later',
    label: 'For Later',
    description: 'Saved items queue with quick actions and device sync.',
    path: '/for-later',
    icon: '📥',
  },
]
