import { describe, expect, it } from 'vitest'
import { mapRssItemsToContent, parseRss } from './parser'

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Example News</title>
    <link>https://example.com</link>
    <image>
      <url>https://example.com/logo.png</url>
    </image>
    <item>
      <title>Launch day</title>
      <link>https://example.com/launch</link>
      <guid>launch-001</guid>
      <pubDate>Wed, 17 Sep 2025 07:00:00 GMT</pubDate>
      <description>We are live!</description>
      <media:thumbnail url="https://example.com/launch.jpg" />
    </item>
    <item>
      <title>Missing link</title>
      <guid>missing-002</guid>
      <pubDate>Wed, 17 Sep 2025 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

describe('RSS parser', () => {
  it('parses feed metadata and items', () => {
    const feed = parseRss(SAMPLE_RSS)
    expect(feed.title).toBe('Example News')
    expect(feed.link).toBe('https://example.com')
    expect(feed.imageUrl).toBe('https://example.com/logo.png')
    expect(feed.items).toHaveLength(1)
    expect(feed.items[0]).toMatchObject({
      id: 'launch-001',
      link: 'https://example.com/launch',
      title: 'Launch day',
      imageUrl: 'https://example.com/launch.jpg',
    })
    expect(feed.items[0].publishedAt?.toISOString()).toBe('2025-09-17T07:00:00.000Z')
  })

  it('maps entries and returns skipped items with reasons', () => {
    const feed = parseRss(SAMPLE_RSS)
    const { entries, skipped } = mapRssItemsToContent(
      feed,
      { sourceId: 'https://example.com/rss.xml', sourceName: 'Example News' },
      {
        sourceType: 'news',
        fallbackCreator: 'Example News',
        now: new Date('2025-09-18T00:00:00Z'),
      },
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      sourceType: 'news',
      sourceId: 'https://example.com/rss.xml',
      externalId: 'launch-001',
      creator: 'Example News',
    })

    expect(skipped).toHaveLength(0)
  })
})
