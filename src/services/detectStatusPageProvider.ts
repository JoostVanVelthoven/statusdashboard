import type {
  AtlassianStatusPayload,
  AtlassianSummaryPayload,
  ProviderDetectionResult,
  StatusPageComponentOption,
} from '../types/status'

const REQUEST_TIMEOUT_MS = 10000

function toReadableError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('Timeout bij ophalen van de statuspagina.')
  }

  if (error instanceof TypeError) {
    return new Error('Ophalen mislukt (mogelijk CORS of netwerkfout).')
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Onbekende fout tijdens ophalen van de statuspagina.')
}

async function fetchJson<T>(url: string): Promise<T> {
  const abortController = new AbortController()
  const timeoutId = window.setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: abortController.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return (await response.json()) as T
  } catch (error) {
    throw toReadableError(error)
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function isAtlassianStatusPayload(payload: unknown): payload is AtlassianStatusPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  const candidate = payload as AtlassianStatusPayload

  return (
    typeof candidate.status?.description === 'string' &&
    (typeof candidate.status?.indicator === 'string' || typeof candidate.status?.indicator === 'undefined')
  )
}

function extractComponentOptions(payload: AtlassianSummaryPayload): StatusPageComponentOption[] {
  if (!Array.isArray(payload.components)) {
    return []
  }

  return payload.components
    .filter(
      (component) =>
        component &&
        typeof component.id === 'string' &&
        typeof component.name === 'string' &&
        component.group !== true,
    )
    .map((component) => ({
      id: component.id as string,
      name: component.name as string,
      status: typeof component.status === 'string' ? component.status : 'unknown',
    }))
}

export function normalizeStatusPageUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim()

  if (!trimmedUrl) {
    throw new Error('URL is verplicht.')
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(trimmedUrl)
  } catch {
    throw new Error('Ongeldig URL-formaat. Gebruik een volledige HTTPS link.')
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Alleen HTTPS URL\'s zijn toegestaan.')
  }

  parsedUrl.hash = ''
  parsedUrl.search = ''

  const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '')

  return normalizedPath ? `${parsedUrl.origin}${normalizedPath}` : parsedUrl.origin
}

export async function detectStatusPageProvider(rawBaseUrl: string): Promise<ProviderDetectionResult> {
  const baseUrl = normalizeStatusPageUrl(rawBaseUrl)
  const statusApiUrl = `${baseUrl}/api/v2/status.json`
  const summaryApiUrl = `${baseUrl}/api/v2/summary.json`

  const [statusResult, summaryResult] = await Promise.allSettled([
    fetchJson<AtlassianStatusPayload>(statusApiUrl),
    fetchJson<AtlassianSummaryPayload>(summaryApiUrl),
  ])

  if (statusResult.status === 'fulfilled' && isAtlassianStatusPayload(statusResult.value)) {
    const summarySupported =
      summaryResult.status === 'fulfilled' && isAtlassianStatusPayload(summaryResult.value)
    const detectedName = summarySupported
      ? statusResult.value.page?.name ?? summaryResult.value.page?.name
      : statusResult.value.page?.name

    return {
      provider: 'atlassian-statuspage',
      baseUrl,
      statusApiUrl,
      summaryApiUrl: summarySupported ? summaryApiUrl : undefined,
      name: detectedName,
      availableComponents: summarySupported ? extractComponentOptions(summaryResult.value) : [],
    }
  }

  const statusError =
    statusResult.status === 'rejected'
      ? statusResult.reason instanceof Error
        ? statusResult.reason.message
        : 'onbekende fout'
      : 'ongeldig status.json formaat'

  const summaryError =
    summaryResult.status === 'rejected'
      ? summaryResult.reason instanceof Error
        ? summaryResult.reason.message
        : 'onbekende fout'
      : isAtlassianStatusPayload(summaryResult.value)
        ? 'summary.json is bereikbaar, maar status.json ontbreekt'
        : 'ongeldig summary.json formaat'

  throw new Error(
    `Geen ondersteunde statuspagina gevonden. status.json: ${statusError}. summary.json: ${summaryError}.`,
  )
}
