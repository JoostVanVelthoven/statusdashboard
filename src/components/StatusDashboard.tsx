import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { detectStatusPageProvider } from '../services/detectStatusPageProvider'
import { fetchStatusPageStatus } from '../services/fetchStatusPageStatus'
import { saveStatusPages } from '../services/localStorageStatusPages'
import { createId } from '../utils/createId'
import { StatusCard } from './StatusCard'
import type { AtlassianIndicator, RuntimeStatus, StoredStatusPage } from '../types/status'

type StatusDashboardProps = {
  pages: StoredStatusPage[]
  refreshToken: number
  onPagesChange: (pages: StoredStatusPage[]) => void
  onLastRefreshChange: (date: Date | null) => void
  onOverallIndicatorChange: (indicator: AtlassianIndicator) => void
}

function indicatorSeverity(indicator: AtlassianIndicator): number {
  switch (indicator) {
    case 'none':
      return 0
    case 'minor':
      return 1
    case 'major':
      return 2
    case 'critical':
      return 3
    default:
      return -1
  }
}

function getDefaultStatus(): RuntimeStatus {
  return {
    indicator: 'unknown',
    description: 'Waiting for first status fetch',
    degradedComponents: [],
    plannedMaintenances: [],
    fetchedAt: null,
    lastSuccessfulAt: null,
    latencyMs: null,
    error: null,
    isLoading: true,
  }
}

export function StatusDashboard({
  pages,
  refreshToken,
  onPagesChange,
  onLastRefreshChange,
  onOverallIndicatorChange,
}: StatusDashboardProps) {
  const navigate = useNavigate()
  const [statusByPageId, setStatusByPageId] = useState<Record<string, RuntimeStatus>>({})
  const [isPolling, setIsPolling] = useState(false)
  const [quickUrl, setQuickUrl] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [isAddingPage, setIsAddingPage] = useState(false)

  const pollStatuses = useCallback(async () => {
    if (pages.length === 0) {
      setStatusByPageId({})
      onLastRefreshChange(null)
      onOverallIndicatorChange('unknown')
      return
    }

    setIsPolling(true)
    setStatusByPageId((previous) => {
      const next = { ...previous }

      for (const page of pages) {
        next[page.id] = {
          ...(previous[page.id] ?? getDefaultStatus()),
          isLoading: true,
          error: null,
        }
      }

      return next
    })

    const result = await Promise.allSettled(pages.map((page) => fetchStatusPageStatus(page)))
    let computedOverallIndicator: AtlassianIndicator = 'unknown'

    setStatusByPageId((previous) => {
      const next = { ...previous }
      const fallbackTimestamp = new Date().toISOString()

      pages.forEach((page, index) => {
        const current = previous[page.id] ?? getDefaultStatus()
        const pageResult = result[index]

        if (pageResult.status === 'fulfilled') {
          next[page.id] = {
            indicator: pageResult.value.indicator,
            description: pageResult.value.description,
            degradedComponents: pageResult.value.degradedComponents,
            plannedMaintenances: pageResult.value.plannedMaintenances,
            fetchedAt: pageResult.value.fetchedAt,
            lastSuccessfulAt: pageResult.value.lastSuccessfulAt,
            latencyMs: pageResult.value.latencyMs,
            error: null,
            isLoading: false,
          }

          return
        }

        next[page.id] = {
          ...current,
          fetchedAt: fallbackTimestamp,
          error:
            pageResult.reason instanceof Error
              ? pageResult.reason.message
              : 'Unknown error while fetching status.',
          isLoading: false,
        }
      })

      computedOverallIndicator = pages.reduce<AtlassianIndicator>((current, page) => {
        const nextIndicator = next[page.id]?.indicator ?? 'unknown'
        return indicatorSeverity(nextIndicator) > indicatorSeverity(current) ? nextIndicator : current
      }, 'unknown')

      return next
    })

    setIsPolling(false)
    onLastRefreshChange(new Date())
    onOverallIndicatorChange(computedOverallIndicator)
  }, [onLastRefreshChange, onOverallIndicatorChange, pages])

  useEffect(() => {
    const kickoffId = window.setTimeout(() => {
      void pollStatuses()
    }, 0)

    const timerId = window.setInterval(() => {
      void pollStatuses()
    }, 60000)

    return () => {
      window.clearTimeout(kickoffId)
      window.clearInterval(timerId)
    }
  }, [pollStatuses])

  useEffect(() => {
    if (refreshToken === 0) {
      return
    }

    const refreshId = window.setTimeout(() => {
      void pollStatuses()
    }, 0)

    return () => {
      window.clearTimeout(refreshId)
    }
  }, [pollStatuses, refreshToken])

  const addPageFromUrl = useCallback(
    async (url: string) => {
      setAddError(null)
      setIsAddingPage(true)

      try {
        const detection = await detectStatusPageProvider(url)
        const alreadyExists = pages.some((page) => page.url === detection.baseUrl)

        if (alreadyExists) {
          throw new Error('This status page is already in the list.')
        }

        const now = new Date().toISOString()
        const hostname = new URL(detection.baseUrl).hostname

        const nextPages: StoredStatusPage[] = [
          ...pages,
          {
            id: createId(),
            name: detection.name?.trim() || hostname,
            url: detection.baseUrl,
            provider: detection.provider,
            statusApiUrl: detection.statusApiUrl,
            summaryApiUrl: detection.summaryApiUrl,
            monitoredComponentIds: detection.availableComponents.map((component) => component.id),
            createdAt: now,
            updatedAt: now,
          },
        ]

        saveStatusPages(nextPages)
        onPagesChange(nextPages)
        setQuickUrl('')
      } catch (error) {
        setAddError(
          error instanceof Error ? error.message : 'Unknown error while adding status page.',
        )
      } finally {
        setIsAddingPage(false)
      }
    },
    [onPagesChange, pages],
  )

  const handleAddSample = useCallback(async () => {
    await addPageFromUrl('https://status.cyso.com')
  }, [addPageFromUrl])

  const cards = useMemo(
    () =>
      pages.map((page) => (
        <StatusCard
          key={page.id}
          page={page}
          status={statusByPageId[page.id] ?? getDefaultStatus()}
          onOpenSettings={() => navigate('/settings', { state: { editPageId: page.id } })}
        />
      )),
    [navigate, pages, statusByPageId],
  )

  return (
    <main className="mx-auto w-full max-w-[1920px] p-8 md:p-10">
      <header className="mb-10 flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight text-slate-100">Integration Status Monitor</h1>
          <p className="mt-3 text-2xl text-slate-300">Environment monitoring • Operational real-time data</p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300">
          <span className="status-pulse h-3 w-3 rounded-full bg-emerald-300" aria-hidden="true" />
          <span className="text-xl font-medium">System Online</span>
          {isPolling ? <span className="text-sm text-emerald-200/80">(Refreshing...)</span> : null}
        </div>
      </header>

      {pages.length === 0 ? (
        <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-dashed border-slate-500/60 bg-[#141d1a]/70 p-10 text-center">
          <h2 className="text-4xl font-semibold text-slate-100">No monitoring configured</h2>
          <p className="mx-auto mt-4 max-w-lg text-xl text-slate-300">
            There are currently no active service monitors configured.
          </p>
          <form
            className="mx-auto mt-8 flex max-w-xl flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void addPageFromUrl(quickUrl)
            }}
          >
            <input
              type="url"
              value={quickUrl}
              onChange={(event) => setQuickUrl(event.target.value)}
              placeholder="https://status.example.com"
              className="w-full rounded-xl border border-slate-600/80 bg-[#0f1714] px-4 py-3 text-lg text-slate-100 outline-none transition focus:border-emerald-400"
              required
            />
            <button
              type="submit"
              disabled={isAddingPage}
              className="rounded-xl bg-emerald-400 px-6 py-3 text-lg font-semibold text-[#042416] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAddingPage ? 'Validating...' : 'Add Status Page'}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                void handleAddSample()
              }}
              disabled={isAddingPage}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-3 text-lg font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Add Sample Cyso Status
            </button>
            <Link
              to="/settings"
              className="rounded-xl border border-slate-600 px-6 py-3 text-lg font-semibold text-slate-200 transition hover:border-slate-400"
            >
              Go to settings
            </Link>
          </div>
          {addError ? <p className="mt-4 text-sm text-rose-300">{addError}</p> : null}
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">{cards}</section>
          {addError ? <p className="mt-6 text-sm text-rose-300">{addError}</p> : null}
        </>
      )}
    </main>
  )
}
