import type { ContentRepository } from '../rss/types'
import type { IngestResult } from '../rss/types'

export interface SpotifyEpisode {
  id: string
  name: string
  description: string
  release_date: string
  duration_ms: number
  external_urls?: {
    spotify?: string
  }
  images?: Array<{ url: string }>
}

export interface SpotifyShow {
  id: string
  name: string
  publisher: string
  images?: Array<{ url: string }>
}

export interface SpotifyEpisodesResponse {
  items: SpotifyEpisode[]
  next: string | null
}

export interface SpotifyTokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
}

export interface SpotifyCredentials {
  clientId: string
  clientSecret: string
}

export interface SpotifyIngestOptions {
  credentials?: SpotifyCredentials
  maxPages?: number
  maxRetries?: number
  timeoutMs?: number
  initialRetryMs?: number
  retryFactor?: number
  randomizeBackoff?: boolean
  delayBetweenMs?: number
}

export interface SpotifyIngestRunOptions extends SpotifyIngestOptions {
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  clock?: () => Date
}

export type SpotifyIngestResult = IngestResult

export type SpotifyContentRepository = ContentRepository
