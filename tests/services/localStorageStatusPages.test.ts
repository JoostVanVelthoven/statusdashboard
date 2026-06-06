import { describe, expect, it } from 'vitest'
import { parseStatusSettingsImport } from '../../src/services/localStorageStatusPages'

const validPage = {
  id: 'page-1',
  name: 'Example status',
  url: 'https://status.example.com',
  provider: 'atlassian-statuspage',
  statusApiUrl: 'https://status.example.com/api/v2/status.json',
  summaryApiUrl: 'https://status.example.com/api/v2/summary.json',
  monitoredComponentIds: ['component-1'],
  createdAt: '2026-06-06T00:00:00.000Z',
  updatedAt: '2026-06-06T00:00:00.000Z',
}

describe('parseStatusSettingsImport', () => {
  it('accepts a valid Atlassian Statuspage record', () => {
    expect(parseStatusSettingsImport(JSON.stringify([validPage]))).toEqual([validPage])
  })

  it.each([
    ['an unsupported provider', { ...validPage, provider: 'custom-provider' }],
    ['an insecure page URL', { ...validPage, url: 'http://status.example.com' }],
    ['an insecure API URL', { ...validPage, statusApiUrl: 'data:application/json,{}' }],
    [
      'a credential-bearing API URL',
      { ...validPage, statusApiUrl: 'https://user:password@status.example.com/api/v2/status.json' },
    ],
  ])('rejects %s', (_description, page) => {
    expect(() => parseStatusSettingsImport(JSON.stringify([page]))).toThrow(
      'JSON array contains no valid status page records.',
    )
  })
})
