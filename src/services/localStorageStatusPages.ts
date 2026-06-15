import { STATUS_PAGES_STORAGE_KEY, type StoredStatusPage } from '../types/status'

export interface StatusSettingsExport {
  schemaVersion: number
  exportedAt: string
  settings: {
    storageKey: string
    pages: StoredStatusPage[]
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string')
}

function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

function parseStoredPage(value: unknown): StoredStatusPage | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<StoredStatusPage>

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    !isSafeHttpsUrl(candidate.url) ||
    (candidate.provider !== 'atlassian-statuspage' && candidate.provider !== 'instatus') ||
    !isSafeHttpsUrl(candidate.statusApiUrl) ||
    (typeof candidate.summaryApiUrl !== 'undefined' && !isSafeHttpsUrl(candidate.summaryApiUrl)) ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: candidate.id,
    name: candidate.name,
    url: candidate.url,
    provider: candidate.provider,
    statusApiUrl: candidate.statusApiUrl,
    summaryApiUrl: typeof candidate.summaryApiUrl === 'string' ? candidate.summaryApiUrl : undefined,
    monitoredComponentIds: toStringArray(candidate.monitoredComponentIds),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  }
}

function parseStoredPagesValue(value: unknown): StoredStatusPage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => parseStoredPage(entry))
    .filter((entry): entry is StoredStatusPage => entry !== null)
}

function parseStoredPages(rawValue: string): StoredStatusPage[] {
  try {
    const parsed = JSON.parse(rawValue)
    return parseStoredPagesValue(parsed)
  } catch {
    return []
  }
}

export function loadStatusPages(): StoredStatusPage[] {
  if (typeof window === 'undefined') {
    return []
  }

  const rawValue = window.localStorage.getItem(STATUS_PAGES_STORAGE_KEY)

  if (!rawValue) {
    return []
  }

  return parseStoredPages(rawValue)
}

export function saveStatusPages(pages: StoredStatusPage[]): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STATUS_PAGES_STORAGE_KEY, JSON.stringify(pages))
}

export function buildStatusSettingsExport(pages: StoredStatusPage[]): StatusSettingsExport {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      storageKey: STATUS_PAGES_STORAGE_KEY,
      pages,
    },
  }
}

export function formatStatusSettingsExport(pages: StoredStatusPage[]): string {
  return JSON.stringify(buildStatusSettingsExport(pages), null, 2)
}

export function parseStatusSettingsImport(rawJson: string): StoredStatusPage[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error('JSON is invalid.')
  }

  if (Array.isArray(parsed)) {
    const pages = parseStoredPagesValue(parsed)

    if (parsed.length > 0 && pages.length === 0) {
      throw new Error('JSON array contains no valid status page records.')
    }

    return pages
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const maybeSettings = parsed as Partial<StatusSettingsExport>
    const rawPages = maybeSettings.settings?.pages
    const pages = parseStoredPagesValue(rawPages)

    if (Array.isArray(rawPages) && rawPages.length > 0 && pages.length === 0) {
      throw new Error('settings.pages contains no valid status page records.')
    }

    if (pages.length > 0 || (Array.isArray(rawPages) && rawPages.length === 0)) {
      return pages
    }
  }

  throw new Error(
    'Unknown import format. Expected an array of pages or an export object with settings.pages.',
  )
}
