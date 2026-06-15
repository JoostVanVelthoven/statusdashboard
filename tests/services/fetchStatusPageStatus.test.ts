import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchStatusPageStatus } from '../../src/services/fetchStatusPageStatus'
import type { StoredStatusPage } from '../../src/types/status'

type MockFetchResponse = {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
}

function createJsonResponse(body: unknown, status = 200, statusText = 'OK'): MockFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  }
}

function createPage(overrides: Partial<StoredStatusPage> = {}): StoredStatusPage {
  return {
    id: 'page-1',
    name: 'Example Status',
    url: 'https://status.example.com',
    provider: 'atlassian-statuspage',
    statusApiUrl: 'https://status.example.com/api/v2/status.json',
    summaryApiUrl: 'https://status.example.com/api/v2/summary.json',
    monitoredComponentIds: [],
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
    ...overrides,
  }
}

describe('fetchStatusPageStatus (Atlassian)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  it('returns page-level status from status.json when no component selection is set', async () => {
    const page = createPage({ monitoredComponentIds: [], summaryApiUrl: undefined })

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/scheduled-maintenances.json')) {
        return createJsonResponse({ scheduled_maintenances: [] })
      }

      if (input.endsWith('/api/v2/status.json')) {
        return createJsonResponse({
          status: { indicator: 'none', description: 'All Systems Operational' },
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await fetchStatusPageStatus(page)

    expect(result.pageId).toBe(page.id)
    expect(result.indicator).toBe('none')
    expect(result.description).toBe('All Systems Operational')
    expect(result.degradedComponents).toEqual([])
    expect(result.plannedMaintenances).toEqual([])
    expect(result.lastSuccessfulAt).toBeTruthy()
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows degraded components from summary.json when no explicit selection exists', async () => {
    const page = createPage({ monitoredComponentIds: [] })

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({
          status: { indicator: 'minor', description: 'Minor Service Outage' },
          components: [
            { id: 'api', name: 'API', status: 'degraded_performance' },
            { id: 'db', name: 'DB', status: 'operational' },
            { id: 'cache', name: 'Cache', status: 'major_outage' },
          ],
        })
      }

      if (input.endsWith('/api/v2/scheduled-maintenances.json')) {
        return createJsonResponse({
          scheduled_maintenances: [
            {
              id: 'maintenance-1',
              name: 'Nightly network change',
              status: 'scheduled',
              scheduled_for: '2026-05-02T18:00:00.000Z',
              scheduled_until: '2026-05-02T19:00:00.000Z',
              components: [{ id: 'api', name: 'API', status: 'under_maintenance' }],
            },
            {
              id: 'maintenance-2',
              name: 'Completed task',
              status: 'completed',
              scheduled_for: '2026-04-01T18:00:00.000Z',
              scheduled_until: '2026-04-01T19:00:00.000Z',
              components: [{ id: 'db', name: 'DB', status: 'operational' }],
            },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('minor')
    expect(result.description).toBe('Minor Service Outage')
    expect(result.degradedComponents).toEqual([
      { id: 'api', name: 'API', status: 'degraded_performance' },
      { id: 'cache', name: 'Cache', status: 'major_outage' },
    ])
    expect(result.plannedMaintenances).toEqual([
      {
        id: 'maintenance-1',
        name: 'Nightly network change',
        status: 'scheduled',
        scheduledFor: '2026-05-02T18:00:00.000Z',
        scheduledUntil: '2026-05-02T19:00:00.000Z',
        impactedComponents: [{ id: 'api', name: 'API', status: 'under_maintenance' }],
      },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://status.example.com/api/v2/summary.json',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://status.example.com/api/v2/scheduled-maintenances.json',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('derives status from selected summary components only', async () => {
    const page = createPage({ monitoredComponentIds: ['api', 'db'] })

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({
          status: { indicator: 'none', description: 'All Systems Operational' },
          components: [
            { id: 'api', name: 'API', status: 'major_outage' },
            { id: 'db', name: 'DB', status: 'operational' },
            { id: 'cdn', name: 'CDN', status: 'major_outage' },
          ],
        })
      }

      if (input.endsWith('/api/v2/scheduled-maintenances.json')) {
        return createJsonResponse({
          scheduled_maintenances: [
            {
              id: 'maintenance-api',
              name: 'API maintenance',
              status: 'scheduled',
              components: [{ id: 'api', name: 'API', status: 'under_maintenance' }],
            },
            {
              id: 'maintenance-cdn',
              name: 'CDN maintenance',
              status: 'scheduled',
              components: [{ id: 'cdn', name: 'CDN', status: 'under_maintenance' }],
            },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('critical')
    expect(result.description).toBe('1/2 selected components degraded')
    expect(result.degradedComponents).toEqual([
      { id: 'api', name: 'API', status: 'major_outage' },
    ])
    expect(result.plannedMaintenances).toEqual([
      {
        id: 'maintenance-api',
        name: 'API maintenance',
        status: 'scheduled',
        scheduledFor: null,
        scheduledUntil: null,
        impactedComponents: [{ id: 'api', name: 'API', status: 'under_maintenance' }],
      },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://status.example.com/api/v2/summary.json',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('returns unknown when selected component IDs are missing in summary.json', async () => {
    const page = createPage({ monitoredComponentIds: ['worker'] })

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({
          status: { indicator: 'none', description: 'All Systems Operational' },
          components: [{ id: 'api', name: 'API', status: 'operational' }],
        })
      }

      if (input.endsWith('/api/v2/scheduled-maintenances.json')) {
        return createJsonResponse({
          scheduled_maintenances: [
            {
              id: 'worker-upgrade',
              name: 'Worker upgrade',
              status: 'scheduled',
              components: [{ id: 'worker', name: 'Worker', status: 'under_maintenance' }],
            },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('unknown')
    expect(result.description).toBe('No selected components found in summary.json.')
    expect(result.degradedComponents).toEqual([])
    expect(result.plannedMaintenances).toEqual([
      {
        id: 'worker-upgrade',
        name: 'Worker upgrade',
        status: 'scheduled',
        scheduledFor: null,
        scheduledUntil: null,
        impactedComponents: [{ id: 'worker', name: 'Worker', status: 'under_maintenance' }],
      },
    ])
  })

  it('falls back to status.json when summary.json fails', async () => {
    const page = createPage({ monitoredComponentIds: [] })

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({ message: 'error' }, 500, 'Server Error')
      }

      if (input.endsWith('/api/v2/scheduled-maintenances.json')) {
        return createJsonResponse({
          scheduled_maintenances: [
            {
              id: 'minor-maintenance',
              name: 'Minor maintenance',
              status: 'scheduled',
              components: [{ id: 'api', name: 'API', status: 'under_maintenance' }],
            },
          ],
        })
      }

      if (input.endsWith('/api/v2/status.json')) {
        return createJsonResponse({
          status: { indicator: 'minor', description: 'Minor Service Outage' },
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('minor')
    expect(result.description).toBe('Minor Service Outage')
    expect(result.degradedComponents).toEqual([])
    expect(result.plannedMaintenances).toEqual([
      {
        id: 'minor-maintenance',
        name: 'Minor maintenance',
        status: 'scheduled',
        scheduledFor: null,
        scheduledUntil: null,
        impactedComponents: [{ id: 'api', name: 'API', status: 'under_maintenance' }],
      },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('maps maintenance-like component states to warning severity', async () => {
    const page = createPage({ monitoredComponentIds: ['db', 'api'] })

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({
          components: [
            { id: 'db', name: 'DB', status: 'under_maintenance' },
            { id: 'api', name: 'API', status: 'operational' },
          ],
        })
      }

      if (input.endsWith('/api/v2/scheduled-maintenances.json')) {
        return createJsonResponse({ scheduled_maintenances: [] })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('minor')
    expect(result.description).toBe('1/2 selected components degraded')
    expect(result.degradedComponents).toEqual([
      { id: 'db', name: 'DB', status: 'under_maintenance' },
    ])
    expect(result.plannedMaintenances).toEqual([])
  })
})

describe('fetchStatusPageStatus (Instatus)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  it('maps selected Instatus components and active maintenance', async () => {
    const page = createPage({
      provider: 'instatus',
      statusApiUrl: 'https://acme.instatus.com/v3/summary.json',
      summaryApiUrl: 'https://acme.instatus.com/v3/components.json',
      monitoredComponentIds: ['api', 'website'],
    })

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/v3/summary.json')) {
        return createJsonResponse({
          page: { name: 'Acme', status: 'HASISSUES' },
          activeMaintenances: [
            {
              id: 'maintenance-1',
              name: 'API upgrade',
              status: 'INPROGRESS',
              start: '2026-06-15T10:00:00Z',
              end: '2026-06-15T11:00:00Z',
              components: [{ id: 'api', name: 'API' }],
            },
          ],
        })
      }
      if (input.endsWith('/v3/components.json')) {
        return createJsonResponse([
          { id: 'api', name: 'API', status: 'PARTIALOUTAGE', isParent: false },
          { id: 'website', name: 'Website', status: 'OPERATIONAL', isParent: false },
        ])
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('major')
    expect(result.description).toBe('1/2 selected components degraded')
    expect(result.degradedComponents).toEqual([
      { id: 'api', name: 'API', status: 'PARTIALOUTAGE' },
    ])
    expect(result.plannedMaintenances).toEqual([
      {
        id: 'maintenance-1',
        name: 'API upgrade',
        status: 'inprogress',
        scheduledFor: '2026-06-15T10:00:00Z',
        scheduledUntil: '2026-06-15T11:00:00Z',
        impactedComponents: [{ id: 'api', name: 'API', status: 'UNDERMAINTENANCE' }],
      },
    ])
  })
})
