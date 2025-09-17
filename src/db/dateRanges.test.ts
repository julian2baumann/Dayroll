import { describe, expect, it } from 'vitest'
import { endOfDay, getRangeBounds, isWithinRange, startOfDay } from './dateRanges'

describe('date range helpers', () => {
  it('calculates start bounds for today', () => {
    const now = new Date('2025-09-17T08:00:00.000Z')
    const { start, end } = getRangeBounds('today', now)

    expect(end.toISOString()).toBe(now.toISOString())
    expect(start.toISOString()).toBe('2025-09-16T08:00:00.000Z')
  })

  it('determines if publishedAt falls within range', () => {
    const now = new Date('2025-09-17T08:00:00.000Z')
    const published = new Date('2025-09-15T09:00:00.000Z')

    expect(isWithinRange('3d', published, now)).toBe(true)
    expect(isWithinRange('today', published, now)).toBe(false)
  })

  it('normalises day boundaries', () => {
    const day = new Date('2025-09-17T13:45:30.000Z')
    const start = startOfDay(day)
    const end = endOfDay(day)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
  })
})
