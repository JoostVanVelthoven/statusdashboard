import { createId } from '../utils/createId'
import { detectStatusPageProvider, normalizeStatusPageUrl } from './detectStatusPageProvider'
import type { ProviderDetectionResult, StoredStatusPage } from '../types/status'

const SHARE_SCHEMA_VERSION = 3
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/
const HTTPS_PREFIX = 'https://'

type SharedSelectionMode = 'i' | 'e'
type CompactSharedStatusPageEntry = [url: string, mode: SharedSelectionMode, componentIdsCsv: string]
type CompactDashboardSharePayload = [version: number, pages: CompactSharedStatusPageEntry[]]

export interface SharedStatusPageEntry {
  url: string
  selectionMode: SharedSelectionMode
  monitoredComponentIds: string[]
}

export interface DashboardSharePayload {
  v: number
  pages: SharedStatusPageEntry[]
}

export interface ResolvedSharedStatusPage {
  detection: ProviderDetectionResult
  selectionMode: SharedSelectionMode
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

function assertCompressionSupport(): void {
  if (
    typeof globalThis.CompressionStream === 'undefined' ||
    typeof globalThis.DecompressionStream === 'undefined'
  ) {
    throw new Error('Compressed dashboard share is not supported in this browser.')
  }
}

function encodeBytesBase64Url(bytes: Uint8Array): string {
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

function decodeBase64UrlToBytes(encoded: string): Uint8Array {
  let normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')

  while (normalized.length % 4 !== 0) {
    normalized += '='
  }

  const binary = globalThis.atob(normalized)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function gzipText(raw: string): Promise<string> {
  assertCompressionSupport()
  const bytes = new TextEncoder().encode(raw)
  const inputStream = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const compressedStream = inputStream.pipeThrough(new globalThis.CompressionStream('gzip'))
  const compressedBuffer = await new Response(compressedStream).arrayBuffer()

  return encodeBytesBase64Url(new Uint8Array(compressedBuffer))
}

async function gunzipToText(encoded: string): Promise<string> {
  assertCompressionSupport()
  const compressedBytes = decodeBase64UrlToBytes(encoded)
  const stableCompressedBytes = new Uint8Array(compressedBytes.byteLength)
  stableCompressedBytes.set(compressedBytes)
  const inputStream = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(stableCompressedBytes)
      controller.close()
    },
  })
  const decompressedStream = inputStream.pipeThrough(new globalThis.DecompressionStream('gzip'))
  const decompressedBuffer = await new Response(decompressedStream).arrayBuffer()

  return new TextDecoder().decode(decompressedBuffer)
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

function toCompactUrl(url: string): string {
  return url.startsWith(HTTPS_PREFIX) ? url.slice(HTTPS_PREFIX.length) : url
}

function fromCompactUrl(compactUrl: string): string {
  if (compactUrl.startsWith('http://') || compactUrl.startsWith('https://')) {
    return compactUrl
  }

  return `${HTTPS_PREFIX}${compactUrl}`
}

function chooseSelectionMode(
  rawSelectedIds: string[],
  availableComponentIds: string[],
): SharedStatusPageEntry {
  const selectedIds = deduplicateStringArray(rawSelectedIds)

  if (selectedIds.length === 0 || availableComponentIds.length === 0) {
    return {
      url: '',
      selectionMode: 'i',
      monitoredComponentIds: selectedIds,
    }
  }

  const availableSet = new Set(availableComponentIds)
  const selectedKnown = selectedIds.filter((componentId) => availableSet.has(componentId))
  const selectedKnownSet = new Set(selectedKnown)
  const excludedIds = availableComponentIds.filter((componentId) => !selectedKnownSet.has(componentId))
  const includeCsv = selectedIds.join(',')
  const excludeCsv = excludedIds.join(',')

  if (excludeCsv.length < includeCsv.length) {
    return {
      url: '',
      selectionMode: 'e',
      monitoredComponentIds: excludedIds,
    }
  }

  return {
    url: '',
    selectionMode: 'i',
    monitoredComponentIds: selectedIds,
  }
}

function toCompactPayload(pages: SharedStatusPageEntry[]): CompactDashboardSharePayload {
  const entries: CompactSharedStatusPageEntry[] = pages.map((page) => [
    toCompactUrl(page.url),
    page.selectionMode,
    deduplicateStringArray(page.monitoredComponentIds).join(','),
  ])

  return [SHARE_SCHEMA_VERSION, entries]
}

function fromCompactPayload(raw: unknown): DashboardSharePayload {
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw new Error('Share payload root object is invalid.')
  }

  const [version, pagesRaw] = raw

  if (version !== SHARE_SCHEMA_VERSION) {
    throw new Error(`Unsupported share payload version: ${String(version)}`)
  }

  if (!Array.isArray(pagesRaw)) {
    throw new Error('Share payload pages are invalid.')
  }

  const pagesByUrl = new Map<string, SharedStatusPageEntry>()

  for (const entry of pagesRaw) {
    if (!Array.isArray(entry) || entry.length !== 3) {
      continue
    }

    const [compactUrl, modeRaw, monitoredComponentIdsRaw] = entry

    if (typeof compactUrl !== 'string') {
      continue
    }

    if (modeRaw !== 'i' && modeRaw !== 'e') {
      continue
    }

    const normalizedUrl = normalizeSharedPageUrl(fromCompactUrl(compactUrl))
    const monitoredComponentIds =
      typeof monitoredComponentIdsRaw === 'string' && monitoredComponentIdsRaw.length > 0
        ? deduplicateStringArray(monitoredComponentIdsRaw.split(',').filter(Boolean))
        : []

    pagesByUrl.set(normalizedUrl, {
      url: normalizedUrl,
      selectionMode: modeRaw,
      monitoredComponentIds,
    })
  }

  return {
    v: SHARE_SCHEMA_VERSION,
    pages: Array.from(pagesByUrl.values()),
  }
}

export async function buildDashboardSharePayload(pages: StoredStatusPage[]): Promise<DashboardSharePayload> {
  const pagesByUrl = new Map<string, string[]>()

  for (const page of pages) {
    let normalizedUrl: string

    try {
      normalizedUrl = normalizeStatusPageUrl(page.url)
    } catch {
      continue
    }

    const existing = pagesByUrl.get(normalizedUrl) ?? []
    pagesByUrl.set(
      normalizedUrl,
      deduplicateStringArray([...existing, ...deduplicateStringArray(page.monitoredComponentIds)]),
    )
  }

  const urls = Array.from(pagesByUrl.keys())
  const detections = await Promise.allSettled(urls.map((url) => detectStatusPageProvider(url)))
  const detectionByUrl = new Map<string, ProviderDetectionResult>()

  for (const [index, detectionResult] of detections.entries()) {
    if (detectionResult.status !== 'fulfilled') {
      continue
    }

    detectionByUrl.set(urls[index], detectionResult.value)
  }

  const sharedPages: SharedStatusPageEntry[] = urls.map((url) => {
    const monitoredComponentIds = pagesByUrl.get(url) ?? []
    const detection = detectionByUrl.get(url)
    const modeSelection = chooseSelectionMode(
      monitoredComponentIds,
      detection?.availableComponents.map((component) => component.id) ?? [],
    )

    return {
      url,
      selectionMode: modeSelection.selectionMode,
      monitoredComponentIds: modeSelection.monitoredComponentIds,
    }
  })

  return {
    v: SHARE_SCHEMA_VERSION,
    pages: sharedPages,
  }
}

export async function encodeDashboardSharePayload(payload: DashboardSharePayload): Promise<string> {
  const normalizedPages: SharedStatusPageEntry[] = payload.pages
    .filter((page): page is SharedStatusPageEntry => typeof page.url === 'string')
    .map((page) => ({
      url: normalizeSharedPageUrl(page.url),
      selectionMode: page.selectionMode === 'e' ? 'e' : 'i',
      monitoredComponentIds: toStringArray(page.monitoredComponentIds),
    }))

  return gzipText(JSON.stringify(toCompactPayload(normalizedPages)))
}

export async function buildDashboardShareHash(pages: StoredStatusPage[]): Promise<string> {
  return encodeDashboardSharePayload(await buildDashboardSharePayload(pages))
}

export async function decodeDashboardSharePayload(
  encodedPayload: string,
): Promise<DashboardSharePayload> {
  if (!encodedPayload || !BASE64_URL_PATTERN.test(encodedPayload)) {
    throw new Error('Share payload format is invalid.')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(await gunzipToText(encodedPayload))
  } catch {
    throw new Error('Share payload could not be decoded.')
  }

  return fromCompactPayload(parsed)
}

export async function parseDashboardShareHash(hash: string): Promise<DashboardSharePayload | null> {
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

  if (!payloadValue || !BASE64_URL_PATTERN.test(payloadValue)) {
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

function resolveIncomingMonitoredComponentIds(
  mode: SharedSelectionMode,
  ids: string[],
  availableComponentIds: string[],
): string[] {
  if (mode === 'e') {
    if (availableComponentIds.length === 0) {
      return []
    }

    const excluded = new Set(ids)
    return availableComponentIds.filter((componentId) => !excluded.has(componentId))
  }

  return sanitizeMonitoredComponentIds(ids, new Set(availableComponentIds))
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
    const availableComponentIds = resolvedPage.detection.availableComponents.map(
      (component) => component.id,
    )
    const availableSet = new Set(availableComponentIds)
    const incomingMonitoredComponentIds = resolveIncomingMonitoredComponentIds(
      resolvedPage.selectionMode,
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
      availableSet,
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
