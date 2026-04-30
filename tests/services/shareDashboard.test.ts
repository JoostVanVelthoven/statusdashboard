import { describe, expect, it } from 'vitest'
import {
  buildDashboardSharePayload,
  decodeDashboardSharePayload,
  encodeDashboardSharePayload,
  mergeResolvedSharedPages,
  parseDashboardShareHash,
} from '../../src/services/shareDashboard'
import type { ProviderDetectionResult, StoredStatusPage } from '../../src/types/status'

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

describe('shareDashboard payload', () => {
  it('encodes and decodes a payload roundtrip', async () => {
    const payload = {
      v: 2,
      pages: [
        {
          url: 'https://status.example.com',
          monitoredComponentIds: ['api', 'db'],
        },
      ],
    }

    const encoded = await encodeDashboardSharePayload(payload)
    const decoded = await decodeDashboardSharePayload(encoded)

    expect(decoded).toEqual(payload)
  })

  it('parses a payload from hash-only value', async () => {
    const payload = buildDashboardSharePayload([
      createStoredPage({ monitoredComponentIds: ['api', 'api', 'db'] }),
    ])
    const encoded = await encodeDashboardSharePayload(payload)
    const parsed = await parseDashboardShareHash(`#${encoded}`)

    expect(parsed).toEqual({
      v: 2,
      pages: [
        {
          url: 'https://status.example.com',
          monitoredComponentIds: ['api', 'db'],
        },
      ],
    })
  })

  it('creates shorter payloads than legacy json+base64 for large selections', async () => {
    const componentIds = Array.from({ length: 35 }, (_, index) => `component-${index + 1}`)
    const payload = {
      v: 2,
      pages: [
        {
          url: 'https://status.example.com',
          monitoredComponentIds: componentIds,
        },
      ],
    }
    const legacyPayload = {
      v: 1,
      pages: [
        {
          url: 'https://status.example.com',
          monitoredComponentIds: componentIds,
        },
      ],
    }
    const legacyEncoded = btoa(JSON.stringify(legacyPayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    const compactEncoded = await encodeDashboardSharePayload(payload)

    expect(compactEncoded.length).toBeLessThan(legacyEncoded.length)
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

  it('returns unchanged when share already matches existing state', () => {
    const existing = createStoredPage({
      monitoredComponentIds: ['api', 'db'],
    })

    const mergeResult = mergeResolvedSharedPages([existing], [
      {
        detection: createDetectionResult(),
        monitoredComponentIds: ['api', 'db'],
      },
    ])

    expect(mergeResult.hasChanges).toBe(false)
    expect(mergeResult.addedCount).toBe(0)
    expect(mergeResult.updatedCount).toBe(0)
    expect(mergeResult.pages).toEqual([existing])
  })
})
