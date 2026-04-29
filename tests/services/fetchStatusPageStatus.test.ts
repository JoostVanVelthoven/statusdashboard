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
    const page = createPage({ monitoredComponentIds: [] })

    fetchMock.mockResolvedValue(
      createJsonResponse({
        status: { indicator: 'none', description: 'All Systems Operational' },
      }),
    )

    const result = await fetchStatusPageStatus(page)

    expect(result.pageId).toBe(page.id)
    expect(result.indicator).toBe('none')
    expect(result.description).toBe('All Systems Operational')
    expect(result.lastSuccessfulAt).toBeTruthy()
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('derives status from selected summary components only', async () => {
    const page = createPage({ monitoredComponentIds: ['api', 'db'] })

    fetchMock.mockResolvedValue(
      createJsonResponse({
        status: { indicator: 'none', description: 'All Systems Operational' },
        components: [
          { id: 'api', name: 'API', status: 'major_outage' },
          { id: 'db', name: 'DB', status: 'operational' },
          { id: 'cdn', name: 'CDN', status: 'major_outage' },
        ],
      }),
    )

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('critical')
    expect(result.description).toBe('1/2 selected components degraded')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://status.example.com/api/v2/summary.json',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('returns unknown when selected component IDs are missing in summary.json', async () => {
    const page = createPage({ monitoredComponentIds: ['worker'] })

    fetchMock.mockResolvedValue(
      createJsonResponse({
        status: { indicator: 'none', description: 'All Systems Operational' },
        components: [{ id: 'api', name: 'API', status: 'operational' }],
      }),
    )

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('unknown')
    expect(result.description).toBe('No selected components found in summary.json.')
  })

  it('falls back to summary payload when status.json fails', async () => {
    const page = createPage({ monitoredComponentIds: [] })

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/status.json')) {
        return createJsonResponse({ message: 'error' }, 500, 'Server Error')
      }

      if (input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({
          status: { indicator: 'minor', description: 'Minor Service Outage' },
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('minor')
    expect(result.description).toBe('Minor Service Outage')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('maps maintenance-like component states to warning severity', async () => {
    const page = createPage({ monitoredComponentIds: ['db', 'api'] })

    fetchMock.mockResolvedValue(
      createJsonResponse({
        components: [
          { id: 'db', name: 'DB', status: 'under_maintenance' },
          { id: 'api', name: 'API', status: 'operational' },
        ],
      }),
    )

    const result = await fetchStatusPageStatus(page)

    expect(result.indicator).toBe('minor')
    expect(result.description).toBe('1/2 selected components degraded')
  })
})
