import crypto from 'node:crypto'

export type HashableContent = {
  sourceType: string
  externalId?: string | null
  url?: string | null
  title?: string | null
}

export function computeContentDedupeHash(input: HashableContent): string {
  const { sourceType, externalId, url, title } = input
  const normalized = [
    sourceType,
    externalId ?? '',
    url ?? '',
    title?.trim().toLowerCase() ?? '',
  ].join('|')
  return crypto.createHash('sha256').update(normalized).digest('hex')
}
