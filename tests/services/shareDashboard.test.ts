import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDashboardSharePayload,
  decodeDashboardSharePayload,
  encodeDashboardSharePayload,
  mergeResolvedSharedPages,
  parseDashboardShareHash,
} from '../../src/services/shareDashboard'
import type {
  ProviderDetectionResult,
  StoredStatusPage,
  AtlassianStatusPayload,
  AtlassianSummaryPayload,
} from '../../src/types/status'

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

function createStoredPage(overrides: Partial<StoredStatusPage> = {}): StoredStatusPage {
  return {
    id: 'page-1',
    name: 'Example Status',
    url: 'https://status.example.com',
    provider: 'atlassian-statuspage',
    statusApiUrl: 'https://status.example.com/api/v2/status.json',
    summaryApiUrl: 'https://status.example.com/api/v2/summary.json',
    monitoredComponentIds: ['api'],
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
    ...overrides,
  }
}

function createDetectionResult(
  overrides: Partial<ProviderDetectionResult> = {},
): ProviderDetectionResult {
  return {
    provider: 'atlassian-statuspage',
    baseUrl: 'https://status.example.com',
    statusApiUrl: 'https://status.example.com/api/v2/status.json',
    summaryApiUrl: 'https://status.example.com/api/v2/summary.json',
    name: 'Example Status',
    availableComponents: [
      { id: 'api', name: 'API', status: 'operational' },
      { id: 'db', name: 'DB', status: 'operational' },
    ],
    ...overrides,
  }
}

function mockStatusPageFetch(
  fetchMock: ReturnType<typeof vi.fn>,
  components: { id: string; name: string; status: string }[],
) {
  fetchMock.mockImplementation(async (input: string) => {
    if (input.endsWith('/api/v2/status.json')) {
      const payload: AtlassianStatusPayload = {
        page: { name: 'Example Status' },
        status: { indicator: 'none', description: 'All Systems Operational' },
      }
      return createJsonResponse(payload)
    }

    if (input.endsWith('/api/v2/summary.json')) {
      const payload: AtlassianSummaryPayload = {
        page: { name: 'Example Status' },
        status: { indicator: 'none', description: 'All Systems Operational' },
        components,
      }
      return createJsonResponse(payload)
    }

    throw new Error(`Unexpected URL: ${input}`)
  })
}

describe('shareDashboard payload', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  it('encodes and decodes a payload roundtrip', async () => {
    const payload = {
      v: 3,
      pages: [
        {
          url: 'https://status.example.com',
          selectionMode: 'i' as const,
          monitoredComponentIds: ['api', 'db'],
        },
      ],
    }

    const encoded = await encodeDashboardSharePayload(payload)
    const decoded = await decodeDashboardSharePayload(encoded)

    expect(decoded).toEqual(payload)
  })

  it('parses a payload from hash-only value', async () => {
    const payload = {
      v: 3,
      pages: [
        {
          url: 'https://status.example.com',
          selectionMode: 'i' as const,
          monitoredComponentIds: ['api', 'db'],
        },
      ],
    }
    const encoded = await encodeDashboardSharePayload(payload)
    const parsed = await parseDashboardShareHash(`#${encoded}`)

    expect(parsed).toEqual(payload)
  })

  it('uses include mode when only a few components are selected', async () => {
    const components = Array.from({ length: 100 }, (_, index) => ({
      id: `component-${index + 1}`,
      name: `Component ${index + 1}`,
      status: 'operational',
    }))
    mockStatusPageFetch(fetchMock, components)
    const payload = await buildDashboardSharePayload([
      createStoredPage({
        monitoredComponentIds: ['component-1'],
      }),
    ])

    expect(payload.pages).toHaveLength(1)
    expect(payload.pages[0].selectionMode).toBe('i')
    expect(payload.pages[0].monitoredComponentIds).toEqual(['component-1'])
  })

  it('uses exclude mode when almost all components are selected', async () => {
    const components = Array.from({ length: 100 }, (_, index) => ({
      id: `component-${index + 1}`,
      name: `Component ${index + 1}`,
      status: 'operational',
    }))
    const selected = components
      .map((component) => component.id)
      .filter((componentId) => componentId !== 'component-100')

    mockStatusPageFetch(fetchMock, components)
    const payload = await buildDashboardSharePayload([
      createStoredPage({
        monitoredComponentIds: selected,
      }),
    ])

    expect(payload.pages).toHaveLength(1)
    expect(payload.pages[0].selectionMode).toBe('e')
    expect(payload.pages[0].monitoredComponentIds).toEqual(['component-100'])
  })
})

describe('mergeResolvedSharedPages', () => {
  it('adds missing page and filters incoming component ids by discovered components', () => {
    const mergeResult = mergeResolvedSharedPages([], [
      {
        detection: createDetectionResult({
          baseUrl: 'https://status.added.com',
          statusApiUrl: 'https://status.added.com/api/v2/status.json',
          summaryApiUrl: 'https://status.added.com/api/v2/summary.json',
          name: 'Added Status',
          availableComponents: [
            { id: 'api', name: 'API', status: 'operational' },
            { id: 'db', name: 'DB', status: 'operational' },
          ],
        }),
        selectionMode: 'i',
        monitoredComponentIds: ['api', 'unknown', 'db'],
      },
    ])

    expect(mergeResult.addedCount).toBe(1)
    expect(mergeResult.updatedCount).toBe(0)
    expect(mergeResult.pages).toHaveLength(1)
    expect(mergeResult.pages[0].url).toBe('https://status.added.com')
    expect(mergeResult.pages[0].monitoredComponentIds).toEqual(['api', 'db'])
  })

  it('merges with existing page by url and unions selected components', () => {
    const existing = createStoredPage({
      id: 'existing-1',
      name: 'Custom Existing Name',
      monitoredComponentIds: ['api'],
      statusApiUrl: 'https://status.example.com/api/v2/old-status.json',
      summaryApiUrl: 'https://status.example.com/api/v2/old-summary.json',
    })

    const mergeResult = mergeResolvedSharedPages([existing], [
      {
        detection: createDetectionResult({
          statusApiUrl: 'https://status.example.com/api/v2/status.json',
          summaryApiUrl: 'https://status.example.com/api/v2/summary.json',
        }),
        selectionMode: 'i',
        monitoredComponentIds: ['db'],
      },
    ])

    expect(mergeResult.addedCount).toBe(0)
    expect(mergeResult.updatedCount).toBe(1)
    expect(mergeResult.pages).toHaveLength(1)
    expect(mergeResult.pages[0].name).toBe('Custom Existing Name')
    expect(mergeResult.pages[0].statusApiUrl).toBe('https://status.example.com/api/v2/status.json')
    expect(mergeResult.pages[0].summaryApiUrl).toBe('https://status.example.com/api/v2/summary.json')
    expect(mergeResult.pages[0].monitoredComponentIds).toEqual(['api', 'db'])
  })

  it('resolves exclude mode into selected list based on discovered components', () => {
    const mergeResult = mergeResolvedSharedPages([], [
      {
        detection: createDetectionResult({
          availableComponents: [
            { id: 'api', name: 'API', status: 'operational' },
            { id: 'db', name: 'DB', status: 'operational' },
            { id: 'worker', name: 'Worker', status: 'operational' },
          ],
        }),
        selectionMode: 'e',
        monitoredComponentIds: ['worker'],
      },
    ])

    expect(mergeResult.pages).toHaveLength(1)
    expect(mergeResult.pages[0].monitoredComponentIds).toEqual(['api', 'db'])
  })
})
