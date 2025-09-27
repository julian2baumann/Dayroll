const rawDemoMode = import.meta.env.VITE_DEMO_MODE
export const isDemoMode = rawDemoMode === 'true'

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL
export const apiBaseUrl =
  typeof rawApiBaseUrl === 'string' && rawApiBaseUrl.length > 0
    ? rawApiBaseUrl.replace(/\/$/, '')
    : ''

export function getApiUrl(path: string) {
  if (!path.startsWith('/')) {
    // Normalise relative path usage so `/api/...` is always constructed correctly
    path = `/${path}`
  }
  if (!apiBaseUrl) {
    return path
  }
  return `${apiBaseUrl}${path}`
}
