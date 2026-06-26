import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  detectStatusPageProvider,
  normalizeStatusPageUrl,
} from '../../src/services/detectStatusPageProvider'

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

describe('normalizeStatusPageUrl', () => {
  it('normalizes https URLs and removes trailing slash', () => {
    expect(normalizeStatusPageUrl(' https://status.example.com/ ')).toBe('https://status.example.com')
    expect(normalizeStatusPageUrl('https://status.example.com/path///')).toBe(
      'https://status.example.com/path',
    )
  })

  it('rejects non-https URLs', () => {
    expect(() => normalizeStatusPageUrl('http://status.example.com')).toThrow(
      'Only HTTPS URLs are allowed.',
    )
  })
})

describe('detectStatusPageProvider (Atlassian)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  it('detects Atlassian provider and extracts components from summary.json', async () => {
    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/status.json')) {
        return createJsonResponse({
          page: { name: 'Cyso' },
          status: { indicator: 'none', description: 'All Systems Operational' },
        })
      }

      if (input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({
          page: { name: 'Cyso' },
          status: { indicator: 'none', description: 'All Systems Operational' },
          components: [
            { id: 'comp-1', name: 'API', status: 'operational' },
            { id: 'comp-2', name: 'DB', status: 'major_outage' },
            { id: 'group-1', name: 'Backend Group', group: true, status: 'operational' },
            { id: 'invalid', status: 'operational' },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await detectStatusPageProvider('https://status.cyso.com/')

    expect(result.provider).toBe('atlassian-statuspage')
    expect(result.baseUrl).toBe('https://status.cyso.com')
    expect(result.statusApiUrl).toBe('https://status.cyso.com/api/v2/status.json')
    expect(result.summaryApiUrl).toBe('https://status.cyso.com/api/v2/summary.json')
    expect(result.name).toBe('Cyso')
    expect(result.availableComponents).toEqual([
      { id: 'comp-1', name: 'API', status: 'operational' },
      { id: 'comp-2', name: 'DB', status: 'major_outage' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('still detects provider when summary.json is unavailable', async () => {
    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/status.json')) {
        return createJsonResponse({
          page: { name: 'Acme' },
          status: { indicator: 'minor', description: 'Minor Service Outage' },
        })
      }

      if (input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({ message: 'Not Found' }, 404, 'Not Found')
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await detectStatusPageProvider('https://status.acme.com')

    expect(result.provider).toBe('atlassian-statuspage')
    expect(result.summaryApiUrl).toBeUndefined()
    expect(result.availableComponents).toEqual([])
  })

  it('throws when status.json is not supported', async () => {
    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/status.json')) {
        return createJsonResponse({ message: 'Not Found' }, 404, 'Not Found')
      }

      if (input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({
          status: { indicator: 'none', description: 'All Systems Operational' },
          components: [],
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    await expect(detectStatusPageProvider('https://status.example.com')).rejects.toThrow(
      'No supported status page found.',
    )
  })

  it('detects Instatus and extracts nested components from its public v3 API', async () => {
    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith('/api/v2/status.json') || input.endsWith('/api/v2/summary.json')) {
        return createJsonResponse({ message: 'Not Found' }, 404, 'Not Found')
      }
      if (input.endsWith('/v3/summary.json')) {
        return createJsonResponse({
          page: { name: 'Acme Instatus', status: 'HASISSUES' },
          activeIncidents: [],
        })
      }
      if (input.endsWith('/v3/components.json')) {
        return createJsonResponse({
          components: [
            {
              id: 'group',
              name: 'Platform',
              status: 'PARTIALOUTAGE',
              isParent: true,
              children: [
                { id: 'api', name: 'API', status: 'PARTIALOUTAGE', isParent: false },
              ],
            },
            { id: 'website', name: 'Website', status: 'OPERATIONAL', isParent: false },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${input}`)
    })

    const result = await detectStatusPageProvider('https://acme.instatus.com')

    expect(result.provider).toBe('instatus')
    expect(result.statusApiUrl).toBe('https://acme.instatus.com/v3/summary.json')
    expect(result.summaryApiUrl).toBe('https://acme.instatus.com/v3/components.json')
    expect(result.name).toBe('Acme Instatus')
    expect(result.availableComponents).toEqual([
      { id: 'api', name: 'API', status: 'PARTIALOUTAGE' },
      { id: 'website', name: 'Website', status: 'OPERATIONAL' },
    ])
  })
})
