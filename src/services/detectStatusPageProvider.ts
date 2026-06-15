import type {
  AtlassianStatusPayload,
  AtlassianSummaryPayload,
  InstatusComponent,
  InstatusSummaryPayload,
  ProviderDetectionResult,
  StatusPageComponentOption,
} from '../types/status'

const REQUEST_TIMEOUT_MS = 10000

function toReadableError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('Timeout while fetching status page.')
  }

  if (error instanceof TypeError) {
    return new Error('Request failed (possible CORS or network error).')
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Unknown error while fetching status page.')
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

function isInstatusSummaryPayload(payload: unknown): payload is InstatusSummaryPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  const candidate = payload as InstatusSummaryPayload
  return typeof candidate.page?.name === 'string' && typeof candidate.page?.status === 'string'
}

function flattenInstatusComponents(components: InstatusComponent[]): InstatusComponent[] {
  return components.flatMap((component) => [
    ...(component.isParent ? [] : [component]),
    ...(Array.isArray(component.children) ? flattenInstatusComponents(component.children) : []),
  ])
}

function extractInstatusComponentOptions(payload: unknown): StatusPageComponentOption[] {
  if (!Array.isArray(payload)) {
    return []
  }

  return flattenInstatusComponents(payload as InstatusComponent[])
    .filter(
      (component) =>
        typeof component.id === 'string' &&
        typeof component.name === 'string' &&
        typeof component.status === 'string',
    )
    .map((component) => ({
      id: component.id as string,
      name: component.name as string,
      status: component.status as string,
    }))
}

export function normalizeStatusPageUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim()

  if (!trimmedUrl) {
    throw new Error('URL is required.')
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(trimmedUrl)
  } catch {
    throw new Error('Invalid URL format. Use a full HTTPS URL.')
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed.')
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

  const instatusSummaryApiUrl = `${baseUrl}/v3/summary.json`
  const instatusComponentsApiUrl = `${baseUrl}/v3/components.json`
  const [instatusSummaryResult, instatusComponentsResult] = await Promise.allSettled([
    fetchJson<InstatusSummaryPayload>(instatusSummaryApiUrl),
    fetchJson<unknown>(instatusComponentsApiUrl),
  ])

  if (
    instatusSummaryResult.status === 'fulfilled' &&
    isInstatusSummaryPayload(instatusSummaryResult.value)
  ) {
    return {
      provider: 'instatus',
      baseUrl,
      statusApiUrl: instatusSummaryApiUrl,
      summaryApiUrl:
        instatusComponentsResult.status === 'fulfilled' ? instatusComponentsApiUrl : undefined,
      name: instatusSummaryResult.value.page?.name,
      availableComponents:
        instatusComponentsResult.status === 'fulfilled'
          ? extractInstatusComponentOptions(instatusComponentsResult.value)
          : [],
    }
  }

  const statusError =
    statusResult.status === 'rejected'
      ? statusResult.reason instanceof Error
        ? statusResult.reason.message
        : 'unknown error'
      : 'invalid status.json format'

  const summaryError =
    summaryResult.status === 'rejected'
      ? summaryResult.reason instanceof Error
        ? summaryResult.reason.message
        : 'unknown error'
      : isAtlassianStatusPayload(summaryResult.value)
        ? 'summary.json is reachable, but status.json is missing'
        : 'invalid summary.json format'

  throw new Error(
    `No supported status page found. status.json: ${statusError}. summary.json: ${summaryError}.`,
  )
}
