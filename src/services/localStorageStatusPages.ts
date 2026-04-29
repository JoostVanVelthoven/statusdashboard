import { STATUS_PAGES_STORAGE_KEY, type StoredStatusPage } from '../types/status'

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string')
}

function parseStoredPage(value: unknown): StoredStatusPage | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<StoredStatusPage>

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.url !== 'string' ||
    typeof candidate.provider !== 'string' ||
    typeof candidate.statusApiUrl !== 'string' ||
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

function parseStoredPages(rawValue: string): StoredStatusPage[] {
  try {
    const parsed = JSON.parse(rawValue)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((entry) => parseStoredPage(entry))
      .filter((entry): entry is StoredStatusPage => entry !== null)
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
