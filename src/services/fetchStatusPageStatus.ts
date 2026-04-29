import type {
  AtlassianSummaryPayload,
  AtlassianStatusPayload,
  AtlassianIndicator,
  StatusFetchResult,
  StoredStatusPage,
} from '../types/status'

const REQUEST_TIMEOUT_MS = 10000

function toReadableError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('Timeout bij ophalen van status.')
  }

  if (error instanceof TypeError) {
    return new Error('Ophalen mislukt (mogelijk CORS of netwerkfout).')
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Onbekende fout tijdens status ophalen.')
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

function normalizeIndicator(indicator: unknown): AtlassianIndicator {
  switch (indicator) {
    case 'none':
      return 'none'
    case 'minor':
    case 'maintenance':
      return 'minor'
    case 'major':
      return 'major'
    case 'critical':
      return 'critical'
    default:
      return 'unknown'
  }
}

function mapComponentStatusToIndicator(status: string): AtlassianIndicator {
  switch (status) {
    case 'operational':
      return 'none'
    case 'degraded_performance':
    case 'under_maintenance':
      return 'minor'
    case 'partial_outage':
      return 'major'
    case 'major_outage':
      return 'critical'
    default:
      return 'unknown'
  }
}

function indicatorSeverity(indicator: AtlassianIndicator): number {
  switch (indicator) {
    case 'none':
      return 0
    case 'minor':
      return 1
    case 'major':
      return 2
    case 'critical':
      return 3
    default:
      return -1
  }
}

function mapPayloadToStatus(pageId: string, payload: AtlassianStatusPayload, latencyMs: number): StatusFetchResult {
  const indicator = normalizeIndicator(payload.status?.indicator)
  const description = payload.status?.description?.trim() || 'Onbekende statusomschrijving'
  const timestamp = new Date().toISOString()

  return {
    pageId,
    indicator,
    description,
    fetchedAt: timestamp,
    lastSuccessfulAt: timestamp,
    latencyMs,
  }
}

function mapMonitoredComponentsToStatus(
  pageId: string,
  payload: AtlassianSummaryPayload,
  monitoredComponentIds: string[],
  latencyMs: number,
): StatusFetchResult {
  const timestamp = new Date().toISOString()

  if (!Array.isArray(payload.components) || payload.components.length === 0) {
    return {
      pageId,
      indicator: 'unknown',
      description: 'Geen componenten gevonden in summary.json.',
      fetchedAt: timestamp,
      lastSuccessfulAt: timestamp,
      latencyMs,
    }
  }

  const componentsById = new Map(
    payload.components
      .filter((component) => component && typeof component.id === 'string')
      .map((component) => [component.id as string, component]),
  )

  const selected = monitoredComponentIds
    .map((componentId) => componentsById.get(componentId))
    .filter((component): component is NonNullable<typeof component> => Boolean(component))

  if (selected.length === 0) {
    return {
      pageId,
      indicator: 'unknown',
      description: 'Geen geselecteerde componenten gevonden in summary.json.',
      fetchedAt: timestamp,
      lastSuccessfulAt: timestamp,
      latencyMs,
    }
  }

  let overall: AtlassianIndicator = 'none'
  let overallSeverity = indicatorSeverity(overall)

  for (const component of selected) {
    const componentIndicator = mapComponentStatusToIndicator(
      typeof component.status === 'string' ? component.status : 'unknown',
    )
    const componentSeverity = indicatorSeverity(componentIndicator)

    if (componentSeverity > overallSeverity) {
      overall = componentIndicator
      overallSeverity = componentSeverity
    }
  }

  if (overallSeverity === -1) {
    overall = 'unknown'
  }

  const affected = selected.filter(
    (component) =>
      mapComponentStatusToIndicator(typeof component.status === 'string' ? component.status : 'unknown') !==
      'none',
  )

  const description =
    affected.length === 0
      ? `${selected.length} geselecteerde componenten operationeel`
      : `${affected.length}/${selected.length} geselecteerde componenten verstoord`

  return {
    pageId,
    indicator: overall,
    description,
    fetchedAt: timestamp,
    lastSuccessfulAt: timestamp,
    latencyMs,
  }
}

export async function fetchStatusPageStatus(page: StoredStatusPage): Promise<StatusFetchResult> {
  const startedAt = Date.now()

  if (page.summaryApiUrl && page.monitoredComponentIds.length > 0) {
    const summaryPayload = await fetchJson<AtlassianSummaryPayload>(page.summaryApiUrl)

    return mapMonitoredComponentsToStatus(
      page.id,
      summaryPayload,
      page.monitoredComponentIds,
      Date.now() - startedAt,
    )
  }

  try {
    const statusPayload = await fetchJson<AtlassianStatusPayload>(page.statusApiUrl)

    return mapPayloadToStatus(page.id, statusPayload, Date.now() - startedAt)
  } catch (primaryError) {
    if (page.summaryApiUrl) {
      try {
        const summaryPayload = await fetchJson<AtlassianStatusPayload>(page.summaryApiUrl)

        return mapPayloadToStatus(page.id, summaryPayload, Date.now() - startedAt)
      } catch {
        throw primaryError
      }
    }

    throw primaryError
  }
}
