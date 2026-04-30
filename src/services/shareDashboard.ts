import { createId } from '../utils/createId'
import { normalizeStatusPageUrl } from './detectStatusPageProvider'
import type { ProviderDetectionResult, StoredStatusPage } from '../types/status'

const SHARE_SCHEMA_VERSION = 1
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/

export interface SharedStatusPageEntry {
  url: string
  monitoredComponentIds: string[]
}

export interface DashboardSharePayload {
  v: number
  pages: SharedStatusPageEntry[]
}

export interface ResolvedSharedStatusPage {
  detection: ProviderDetectionResult
  monitoredComponentIds: string[]
}

export interface MergeSharedPagesResult {
  pages: StoredStatusPage[]
  addedCount: number
  updatedCount: number
  mergedCount: number
  hasChanges: boolean
}

function deduplicateStringArray(values: string[]): string[] {
  return Array.from(new Set(values))
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return deduplicateStringArray(value.filter((entry): entry is string => typeof entry === 'string'))
}

function encodeBase64Url(raw: string): string {
  const bytes = new TextEncoder().encode(raw)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeBase64Url(encoded: string): string {
  let normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')

  while (normalized.length % 4 !== 0) {
    normalized += '='
  }

  const binary = globalThis.atob(normalized)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

function normalizeSharedPageUrl(rawUrl: string): string {
  try {
    return normalizeStatusPageUrl(rawUrl)
  } catch {
    throw new Error(`Invalid shared URL: ${rawUrl}`)
  }
}

function sanitizeMonitoredComponentIds(
  monitoredComponentIds: string[],
  availableComponentIds: Set<string>,
): string[] {
  const deduplicated = deduplicateStringArray(monitoredComponentIds)

  if (availableComponentIds.size === 0) {
    return deduplicated
  }

  return deduplicated.filter((componentId) => availableComponentIds.has(componentId))
}

function areArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((value, index) => value === b[index])
}

export function buildDashboardSharePayload(pages: StoredStatusPage[]): DashboardSharePayload {
  const pagesByUrl = new Map<string, SharedStatusPageEntry>()

  for (const page of pages) {
    let normalizedUrl: string

    try {
      normalizedUrl = normalizeStatusPageUrl(page.url)
    } catch {
      continue
    }

    const existing = pagesByUrl.get(normalizedUrl)
    const deduplicatedIds = deduplicateStringArray(page.monitoredComponentIds)

    if (!existing) {
      pagesByUrl.set(normalizedUrl, {
        url: normalizedUrl,
        monitoredComponentIds: deduplicatedIds,
      })
      continue
    }

    pagesByUrl.set(normalizedUrl, {
      url: normalizedUrl,
      monitoredComponentIds: deduplicateStringArray([
        ...existing.monitoredComponentIds,
        ...deduplicatedIds,
      ]),
    })
  }

  return {
    v: SHARE_SCHEMA_VERSION,
    pages: Array.from(pagesByUrl.values()),
  }
}

export function encodeDashboardSharePayload(payload: DashboardSharePayload): string {
  return encodeBase64Url(JSON.stringify(payload))
}

export function buildDashboardShareHash(pages: StoredStatusPage[]): string {
  return encodeDashboardSharePayload(buildDashboardSharePayload(pages))
}

export function decodeDashboardSharePayload(encodedPayload: string): DashboardSharePayload {
  if (!encodedPayload || !BASE64_URL_PATTERN.test(encodedPayload)) {
    throw new Error('Share payload format is invalid.')
  }

  let parsed: unknown

  try {
    const rawJson = decodeBase64Url(encodedPayload)
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error('Share payload could not be decoded.')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Share payload root object is invalid.')
  }

  const candidate = parsed as Partial<DashboardSharePayload>

  if (candidate.v !== SHARE_SCHEMA_VERSION) {
    throw new Error(`Unsupported share payload version: ${String(candidate.v)}`)
  }

  if (!Array.isArray(candidate.pages)) {
    throw new Error('Share payload pages are invalid.')
  }

  const pagesByUrl = new Map<string, SharedStatusPageEntry>()

  for (const page of candidate.pages) {
    if (typeof page !== 'object' || page === null) {
      continue
    }

    const entry = page as Partial<SharedStatusPageEntry>

    if (typeof entry.url !== 'string') {
      continue
    }

    const normalizedUrl = normalizeSharedPageUrl(entry.url)
    const monitoredComponentIds = toStringArray(entry.monitoredComponentIds)
    const existing = pagesByUrl.get(normalizedUrl)

    if (!existing) {
      pagesByUrl.set(normalizedUrl, {
        url: normalizedUrl,
        monitoredComponentIds,
      })
      continue
    }

    pagesByUrl.set(normalizedUrl, {
      url: normalizedUrl,
      monitoredComponentIds: deduplicateStringArray([
        ...existing.monitoredComponentIds,
        ...monitoredComponentIds,
      ]),
    })
  }

  return {
    v: SHARE_SCHEMA_VERSION,
    pages: Array.from(pagesByUrl.values()),
  }
}

export function parseDashboardShareHash(hash: string): DashboardSharePayload | null {
  const trimmedHash = hash.trim()

  if (!trimmedHash) {
    return null
  }

  const rawHashValue = trimmedHash.startsWith('#') ? trimmedHash.slice(1) : trimmedHash

  if (!rawHashValue) {
    return null
  }

  const payloadValue = rawHashValue.startsWith('share=')
    ? rawHashValue.slice('share='.length)
    : rawHashValue

  if (!payloadValue) {
    return null
  }

  if (!BASE64_URL_PATTERN.test(payloadValue)) {
    return null
  }

  return decodeDashboardSharePayload(payloadValue)
}

function normalizePageUrlForCompare(url: string): string {
  try {
    return normalizeStatusPageUrl(url)
  } catch {
    return url
  }
}

function mergeMonitoredComponentIds(
  existingIds: string[],
  incomingIds: string[],
  availableComponentIds: Set<string>,
): string[] {
  return sanitizeMonitoredComponentIds(
    deduplicateStringArray([...existingIds, ...incomingIds]),
    availableComponentIds,
  )
}

export function mergeResolvedSharedPages(
  currentPages: StoredStatusPage[],
  resolvedPages: ResolvedSharedStatusPage[],
): MergeSharedPagesResult {
  const nextPages = [...currentPages]
  let addedCount = 0
  let updatedCount = 0

  for (const resolvedPage of resolvedPages) {
    const normalizedUrl = normalizePageUrlForCompare(resolvedPage.detection.baseUrl)
    const availableComponentIds = new Set(
      resolvedPage.detection.availableComponents.map((component) => component.id),
    )
    const incomingMonitoredComponentIds = sanitizeMonitoredComponentIds(
      resolvedPage.monitoredComponentIds,
      availableComponentIds,
    )
    const existingIndex = nextPages.findIndex(
      (page) => normalizePageUrlForCompare(page.url) === normalizedUrl,
    )

    if (existingIndex === -1) {
      const now = new Date().toISOString()
      const hostname = new URL(normalizedUrl).hostname

      nextPages.push({
        id: createId(),
        name: resolvedPage.detection.name?.trim() || hostname,
        url: normalizedUrl,
        provider: resolvedPage.detection.provider,
        statusApiUrl: resolvedPage.detection.statusApiUrl,
        summaryApiUrl: resolvedPage.detection.summaryApiUrl,
        monitoredComponentIds: incomingMonitoredComponentIds,
        createdAt: now,
        updatedAt: now,
      })
      addedCount += 1
      continue
    }

    const existingPage = nextPages[existingIndex]
    const mergedMonitoredComponentIds = mergeMonitoredComponentIds(
      existingPage.monitoredComponentIds,
      incomingMonitoredComponentIds,
      availableComponentIds,
    )
    const shouldUpdate =
      existingPage.url !== normalizedUrl ||
      existingPage.provider !== resolvedPage.detection.provider ||
      existingPage.statusApiUrl !== resolvedPage.detection.statusApiUrl ||
      existingPage.summaryApiUrl !== resolvedPage.detection.summaryApiUrl ||
      !areArraysEqual(existingPage.monitoredComponentIds, mergedMonitoredComponentIds)

    if (!shouldUpdate) {
      continue
    }

    nextPages[existingIndex] = {
      ...existingPage,
      url: normalizedUrl,
      provider: resolvedPage.detection.provider,
      statusApiUrl: resolvedPage.detection.statusApiUrl,
      summaryApiUrl: resolvedPage.detection.summaryApiUrl,
      monitoredComponentIds: mergedMonitoredComponentIds,
      updatedAt: new Date().toISOString(),
    }
    updatedCount += 1
  }

  return {
    pages: nextPages,
    addedCount,
    updatedCount,
    mergedCount: addedCount + updatedCount,
    hasChanges: addedCount > 0 || updatedCount > 0,
  }
}
