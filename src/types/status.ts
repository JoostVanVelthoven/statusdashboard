export const STATUS_PAGES_STORAGE_KEY = 'status-monitor-pages'

export type StatusPageProvider = 'atlassian-statuspage'

export interface StoredStatusPage {
  id: string
  name: string
  url: string
  provider: StatusPageProvider
  statusApiUrl: string
  summaryApiUrl?: string
  monitoredComponentIds: string[]
  createdAt: string
  updatedAt: string
}

export type AtlassianIndicator = 'none' | 'minor' | 'major' | 'critical' | 'unknown'

export interface AtlassianPageInfo {
  id?: string
  name?: string
  url?: string
  time_zone?: string
  updated_at?: string
}

export interface AtlassianComponent {
  id?: string
  name?: string
  status?: string
  group?: boolean
}

export interface AtlassianStatusPayload {
  page?: AtlassianPageInfo
  status?: {
    indicator?: string
    description?: string
  }
}

export interface AtlassianSummaryPayload extends AtlassianStatusPayload {
  components?: AtlassianComponent[]
}

export interface StatusPageComponentOption {
  id: string
  name: string
  status: string
}

export interface ProviderDetectionResult {
  provider: StatusPageProvider
  baseUrl: string
  statusApiUrl: string
  summaryApiUrl?: string
  name?: string
  availableComponents: StatusPageComponentOption[]
}

export interface StatusFetchResult {
  pageId: string
  indicator: AtlassianIndicator
  description: string
  fetchedAt: string
  lastSuccessfulAt: string
  latencyMs: number
}

export interface RuntimeStatus {
  indicator: AtlassianIndicator
  description: string
  fetchedAt: string | null
  lastSuccessfulAt: string | null
  latencyMs: number | null
  error: string | null
  isLoading: boolean
}
