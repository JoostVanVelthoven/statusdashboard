import type {
  AtlassianScheduledMaintenancesPayload,
  AtlassianSummaryPayload,
  AtlassianStatusPayload,
  AtlassianIndicator,
  InstatusComponent,
  InstatusSummaryPayload,
  PlannedMaintenance,
  StatusPageComponentOption,
  StatusFetchResult,
  StoredStatusPage,
} from '../types/status'

const REQUEST_TIMEOUT_MS = 10000

function toReadableError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('Timeout while fetching status.')
  }

  if (error instanceof TypeError) {
    return new Error('Request failed (possible CORS or network error).')
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Unknown error while fetching status.')
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

function mapInstatusStatusToIndicator(status: unknown): AtlassianIndicator {
  if (typeof status !== 'string') {
    return 'unknown'
  }

  const normalized = status.toUpperCase()

  if (normalized === 'UP' || normalized === 'OPERATIONAL') {
    return 'none'
  }
  if (normalized.includes('MAJOROUTAGE')) {
    return 'critical'
  }
  if (normalized.includes('MINOROUTAGE') || normalized.includes('PARTIALOUTAGE')) {
    return 'major'
  }
  if (normalized.includes('MAINTENANCE') || normalized.includes('DEGRADED')) {
    return 'minor'
  }
  if (normalized === 'HASISSUES' || normalized === 'DOWN') {
    return 'major'
  }

  return 'unknown'
}

function flattenInstatusComponents(components: InstatusComponent[]): InstatusComponent[] {
  return components.flatMap((component) => [
    ...(component.isParent ? [] : [component]),
    ...(Array.isArray(component.children) ? flattenInstatusComponents(component.children) : []),
  ])
}

function mapInstatusStatus(
  page: StoredStatusPage,
  summary: InstatusSummaryPayload,
  componentsPayload: unknown,
  latencyMs: number,
): StatusFetchResult {
  const timestamp = new Date().toISOString()
  const components = Array.isArray(componentsPayload)
    ? flattenInstatusComponents(componentsPayload as InstatusComponent[])
    : []
  const targetIds =
    page.monitoredComponentIds.length > 0 ? new Set(page.monitoredComponentIds) : null
  const selectedComponents = components.filter(
    (component) =>
      typeof component.id === 'string' && (!targetIds || targetIds.has(component.id)),
  )
  const degradedComponents = selectedComponents
    .filter((component) => mapInstatusStatusToIndicator(component.status) !== 'none')
    .map((component) => ({
      id: component.id as string,
      name: typeof component.name === 'string' ? component.name : 'Unnamed component',
      status: typeof component.status === 'string' ? component.status : 'UNKNOWN',
    }))

  let indicator = mapInstatusStatusToIndicator(summary.page?.status)
  let description =
    indicator === 'none' ? 'All systems operational' : 'Instatus reports active issues'

  if (targetIds) {
    if (selectedComponents.length === 0) {
      indicator = 'unknown'
      description = 'No selected components found in components.json.'
    } else {
      indicator = selectedComponents.reduce<AtlassianIndicator>((current, component) => {
        const next = mapInstatusStatusToIndicator(component.status)
        return indicatorSeverity(next) > indicatorSeverity(current) ? next : current
      }, 'none')
      description =
        degradedComponents.length === 0
          ? `${selectedComponents.length} selected components operational`
          : `${degradedComponents.length}/${selectedComponents.length} selected components degraded`
    }
  }

  const plannedMaintenances = Array.isArray(summary.activeMaintenances)
    ? summary.activeMaintenances
        .map((maintenance, index) => ({
          id: typeof maintenance.id === 'string' ? maintenance.id : `maintenance-${index}`,
          name:
            typeof maintenance.name === 'string' && maintenance.name.trim()
              ? maintenance.name.trim()
              : 'Scheduled maintenance',
          status:
            typeof maintenance.status === 'string' ? maintenance.status.toLowerCase() : 'active',
          scheduledFor: typeof maintenance.start === 'string' ? maintenance.start : null,
          scheduledUntil: typeof maintenance.end === 'string' ? maintenance.end : null,
          impactedComponents: Array.isArray(maintenance.components)
            ? maintenance.components
                .filter(
                  (component) =>
                    typeof component.id === 'string' &&
                    typeof component.name === 'string' &&
                    (!targetIds || targetIds.has(component.id)),
                )
                .map((component) => ({
                  id: component.id as string,
                  name: component.name as string,
                  status: 'UNDERMAINTENANCE',
                }))
            : [],
        }))
        .filter((maintenance) => !targetIds || maintenance.impactedComponents.length > 0)
    : []

  return {
    pageId: page.id,
    indicator,
    description,
    degradedComponents,
    plannedMaintenances,
    fetchedAt: timestamp,
    lastSuccessfulAt: timestamp,
    latencyMs,
  }
}

function mapPayloadToStatus(
  pageId: string,
  payload: AtlassianStatusPayload,
  latencyMs: number,
  plannedMaintenances: PlannedMaintenance[],
): StatusFetchResult {
  const indicator = normalizeIndicator(payload.status?.indicator)
  const description = payload.status?.description?.trim() || 'Unknown status description'
  const timestamp = new Date().toISOString()

  return {
    pageId,
    indicator,
    description,
    degradedComponents: [],
    plannedMaintenances,
    fetchedAt: timestamp,
    lastSuccessfulAt: timestamp,
    latencyMs,
  }
}

function extractDegradedComponentsFromSummary(
  payload: AtlassianSummaryPayload,
  monitoredComponentIds: string[] | null,
): StatusPageComponentOption[] {
  if (!Array.isArray(payload.components)) {
    return []
  }

  const targetIds = monitoredComponentIds ? new Set(monitoredComponentIds) : null

  return payload.components
    .filter((component) => component && component.group !== true && typeof component.id === 'string')
    .filter((component) => (targetIds ? targetIds.has(component.id as string) : true))
    .filter((component) => {
      const indicator = mapComponentStatusToIndicator(
        typeof component.status === 'string' ? component.status : 'unknown',
      )
      return indicator !== 'none'
    })
    .map((component) => ({
      id: component.id as string,
      name: typeof component.name === 'string' ? component.name : 'Unnamed component',
      status: typeof component.status === 'string' ? component.status : 'unknown',
    }))
}

function normalizeMaintenanceStatus(status: unknown): string {
  return typeof status === 'string' ? status.toLowerCase() : 'unknown'
}

function isUpcomingOrActiveMaintenanceStatus(status: string): boolean {
  return status === 'scheduled' || status === 'in_progress' || status === 'verifying'
}

function extractPlannedMaintenancesFromPayload(
  payload: AtlassianScheduledMaintenancesPayload | null,
  monitoredComponentIds: string[] | null,
): PlannedMaintenance[] {
  if (!payload || !Array.isArray(payload.scheduled_maintenances)) {
    return []
  }

  const targetIds = monitoredComponentIds ? new Set(monitoredComponentIds) : null

  return payload.scheduled_maintenances
    .map((maintenance, index) => {
      const status = normalizeMaintenanceStatus(maintenance?.status)
      const impactedComponents = Array.isArray(maintenance?.components)
        ? maintenance.components
            .filter(
              (component) =>
                component &&
                component.group !== true &&
                typeof component.id === 'string' &&
                typeof component.name === 'string',
            )
            .map((component) => ({
              id: component.id as string,
              name: component.name as string,
              status: typeof component.status === 'string' ? component.status : 'unknown',
            }))
        : []

      return {
        id: typeof maintenance?.id === 'string' ? maintenance.id : `maintenance-${index}`,
        name:
          typeof maintenance?.name === 'string' && maintenance.name.trim()
            ? maintenance.name.trim()
            : 'Scheduled maintenance',
        status,
        scheduledFor: typeof maintenance?.scheduled_for === 'string' ? maintenance.scheduled_for : null,
        scheduledUntil: typeof maintenance?.scheduled_until === 'string' ? maintenance.scheduled_until : null,
        impactedComponents,
      }
    })
    .filter((maintenance) => isUpcomingOrActiveMaintenanceStatus(maintenance.status))
    .filter((maintenance) =>
      targetIds
        ? maintenance.impactedComponents.some((component) => targetIds.has(component.id))
        : true,
    )
}

function mapSummaryToPageStatus(
  pageId: string,
  payload: AtlassianSummaryPayload,
  plannedMaintenances: PlannedMaintenance[],
  latencyMs: number,
): StatusFetchResult {
  const timestamp = new Date().toISOString()
  const degradedComponents = extractDegradedComponentsFromSummary(payload, null)
  let indicator = normalizeIndicator(payload.status?.indicator)

  if (indicator === 'unknown' && degradedComponents.length > 0) {
    indicator = degradedComponents.reduce<AtlassianIndicator>((current, component) => {
      const next = mapComponentStatusToIndicator(component.status)
      return indicatorSeverity(next) > indicatorSeverity(current) ? next : current
    }, 'none')
  }

  const description =
    payload.status?.description?.trim() ||
    (degradedComponents.length > 0
      ? `${degradedComponents.length} components degraded`
      : 'Unknown status description')

  return {
    pageId,
    indicator,
    description,
    degradedComponents,
    plannedMaintenances,
    fetchedAt: timestamp,
    lastSuccessfulAt: timestamp,
    latencyMs,
  }
}

function mapMonitoredComponentsToStatus(
  pageId: string,
  payload: AtlassianSummaryPayload,
  monitoredComponentIds: string[],
  plannedMaintenances: PlannedMaintenance[],
  latencyMs: number,
): StatusFetchResult {
  const timestamp = new Date().toISOString()

  if (!Array.isArray(payload.components) || payload.components.length === 0) {
    return {
      pageId,
      indicator: 'unknown',
      description: 'No components found in summary.json.',
      degradedComponents: [],
      plannedMaintenances,
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
      description: 'No selected components found in summary.json.',
      degradedComponents: [],
      plannedMaintenances,
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

  const degradedComponents = extractDegradedComponentsFromSummary(payload, monitoredComponentIds)

  const description =
    degradedComponents.length === 0
      ? `${selected.length} selected components operational`
      : `${degradedComponents.length}/${selected.length} selected components degraded`

  return {
    pageId,
    indicator: overall,
    description,
    degradedComponents,
    plannedMaintenances,
    fetchedAt: timestamp,
    lastSuccessfulAt: timestamp,
    latencyMs,
  }
}

export async function fetchStatusPageStatus(page: StoredStatusPage): Promise<StatusFetchResult> {
  const startedAt = Date.now()

  if (page.provider === 'instatus') {
    const [summary, components] = await Promise.all([
      fetchJson<InstatusSummaryPayload>(page.statusApiUrl),
      page.summaryApiUrl ? fetchJson<unknown>(page.summaryApiUrl) : Promise.resolve([]),
    ])
    return mapInstatusStatus(page, summary, components, Date.now() - startedAt)
  }

  const scheduledMaintenancesApiUrl = `${page.url}/api/v2/scheduled-maintenances.json`
  const monitoredIds = page.monitoredComponentIds.length > 0 ? page.monitoredComponentIds : null
  let plannedMaintenances: PlannedMaintenance[] = []
  let hasScheduledMaintenanceAttempt = false

  if (page.summaryApiUrl) {
    const [summaryResult, scheduledMaintenancesResult] = await Promise.allSettled([
      fetchJson<AtlassianSummaryPayload>(page.summaryApiUrl),
      fetchJson<AtlassianScheduledMaintenancesPayload>(scheduledMaintenancesApiUrl),
    ])
    hasScheduledMaintenanceAttempt = true

    if (scheduledMaintenancesResult.status === 'fulfilled') {
      plannedMaintenances = extractPlannedMaintenancesFromPayload(
        scheduledMaintenancesResult.value,
        monitoredIds,
      )
    }

    if (summaryResult.status === 'fulfilled') {
      const summaryPayload = summaryResult.value

      if (page.monitoredComponentIds.length > 0) {
        return mapMonitoredComponentsToStatus(
          page.id,
          summaryPayload,
          page.monitoredComponentIds,
          plannedMaintenances,
          Date.now() - startedAt,
        )
      }

      return mapSummaryToPageStatus(page.id, summaryPayload, plannedMaintenances, Date.now() - startedAt)
    }
  }

  if (!hasScheduledMaintenanceAttempt) {
    try {
      const scheduledMaintenancesPayload = await fetchJson<AtlassianScheduledMaintenancesPayload>(
        scheduledMaintenancesApiUrl,
      )
      plannedMaintenances = extractPlannedMaintenancesFromPayload(scheduledMaintenancesPayload, monitoredIds)
    } catch {
      plannedMaintenances = []
    }
  }

  const statusPayload = await fetchJson<AtlassianStatusPayload>(page.statusApiUrl)
  return mapPayloadToStatus(page.id, statusPayload, Date.now() - startedAt, plannedMaintenances)
}
