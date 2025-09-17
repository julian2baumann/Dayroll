export type FeedRange = 'today' | '3d' | '7d'

const RANGE_TO_MS: Record<FeedRange, number> = {
  today: 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

export function getRangeBounds(
  range: FeedRange,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const windowMs = RANGE_TO_MS[range]
  const end = new Date(now)
  const start = new Date(end.getTime() - windowMs)
  return { start, end }
}

export function isWithinRange(
  range: FeedRange,
  publishedAt: Date,
  now: Date = new Date(),
): boolean {
  const { start, end } = getRangeBounds(range, now)
  return publishedAt >= start && publishedAt <= end
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}
