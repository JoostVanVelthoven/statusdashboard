import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectStatusPageProvider } from '../services/detectStatusPageProvider'
import { fetchStatusPageStatus } from '../services/fetchStatusPageStatus'
import { saveStatusPages } from '../services/localStorageStatusPages'
import { createId } from '../utils/createId'
import { StatusCard } from './StatusCard'
import { StatusPageForm } from './StatusPageForm'
import type {
  AtlassianIndicator,
  ProviderDetectionResult,
  RuntimeStatus,
  StoredStatusPage,
} from '../types/status'

type StatusDashboardProps = {
  pages: StoredStatusPage[]
  refreshToken: number
  onPagesChange: (pages: StoredStatusPage[]) => void
  onOverallIndicatorChange: (indicator: AtlassianIndicator) => void
}

type AddPageDraft = {
  detection: ProviderDetectionResult
  initialName: string
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
  onOverallIndicatorChange,
}: StatusDashboardProps) {
  const [statusByPageId, setStatusByPageId] = useState<Record<string, RuntimeStatus>>({})
  const [isPolling, setIsPolling] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [isAddingPage, setIsAddingPage] = useState(false)
  const [isPreparingAddFlow, setIsPreparingAddFlow] = useState(false)
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState('https://')
  const [urlModalError, setUrlModalError] = useState<string | null>(null)
  const [isAddFormModalOpen, setIsAddFormModalOpen] = useState(false)
  const [addFormError, setAddFormError] = useState<string | null>(null)
  const [addPageDraft, setAddPageDraft] = useState<AddPageDraft | null>(null)
  const urlModalRef = useRef<HTMLDialogElement | null>(null)
  const addFormModalRef = useRef<HTMLDialogElement | null>(null)

  const pollStatuses = useCallback(async () => {
    if (pages.length === 0) {
      setStatusByPageId({})
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
    onOverallIndicatorChange(computedOverallIndicator)
  }, [onOverallIndicatorChange, pages])

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

  useEffect(() => {
    const dialog = urlModalRef.current

    if (!dialog) {
      return
    }

    if (isUrlModalOpen) {
      if (!dialog.open) {
        dialog.showModal()
      }
      return
    }

    if (dialog.open) {
      dialog.close()
    }
  }, [isUrlModalOpen])

  useEffect(() => {
    const dialog = addFormModalRef.current

    if (!dialog) {
      return
    }

    if (isAddFormModalOpen) {
      if (!dialog.open) {
        dialog.showModal()
      }
      return
    }

    if (dialog.open) {
      dialog.close()
    }
  }, [isAddFormModalOpen])

  const buildStoredPage = useCallback(
    (detection: ProviderDetectionResult, preferredName: string): StoredStatusPage => {
      const now = new Date().toISOString()
      const hostname = new URL(detection.baseUrl).hostname

      return {
        id: createId(),
        name: preferredName.trim() || detection.name?.trim() || hostname,
        url: detection.baseUrl,
        provider: detection.provider,
        statusApiUrl: detection.statusApiUrl,
        summaryApiUrl: detection.summaryApiUrl,
        monitoredComponentIds: detection.availableComponents.map((component) => component.id),
        createdAt: now,
        updatedAt: now,
      }
    },
    [],
  )

  const closeUrlModal = useCallback(() => {
    if (isPreparingAddFlow) {
      return
    }

    setIsUrlModalOpen(false)
    setUrlModalError(null)
  }, [isPreparingAddFlow])

  const closeAddFormModal = useCallback(() => {
    if (isAddingPage) {
      return
    }

    setIsAddFormModalOpen(false)
    setAddFormError(null)
    setAddPageDraft(null)
  }, [isAddingPage])

  const handleUrlDraftSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (isPreparingAddFlow) {
        return
      }

      setUrlModalError(null)
      setAddError(null)
      setIsPreparingAddFlow(true)

      try {
        const detection = await detectStatusPageProvider(urlDraft)
        const alreadyExists = pages.some((page) => page.url === detection.baseUrl)

        if (alreadyExists) {
          throw new Error('This status page is already in the list.')
        }

        const initialName = detection.name?.trim() || new URL(detection.baseUrl).hostname
        setAddPageDraft({ detection, initialName })
        setIsUrlModalOpen(false)
        setAddFormError(null)
        setIsAddFormModalOpen(true)
      } catch (error) {
        setUrlModalError(error instanceof Error ? error.message : 'Unknown error while validating URL.')
      } finally {
        setIsPreparingAddFlow(false)
      }
    },
    [isPreparingAddFlow, pages, urlDraft],
  )

  const handleAddFormSubmit = useCallback(
    async (values: { name: string; url: string }) => {
      setAddFormError(null)
      setAddError(null)
      setIsAddingPage(true)

      try {
        const rawUrl = values.url.trim()
        const hasUnchangedDraftUrl =
          addPageDraft && rawUrl.length > 0 && rawUrl === addPageDraft.detection.baseUrl
        const detection = hasUnchangedDraftUrl
          ? addPageDraft.detection
          : await detectStatusPageProvider(rawUrl)
        const alreadyExists = pages.some((page) => page.url === detection.baseUrl)

        if (alreadyExists) {
          throw new Error('This status page is already in the list.')
        }

        const nextPages: StoredStatusPage[] = [...pages, buildStoredPage(detection, values.name)]
        saveStatusPages(nextPages)
        onPagesChange(nextPages)

        setIsAddFormModalOpen(false)
        setAddPageDraft(null)
        setUrlDraft('https://')
      } catch (error) {
        setAddFormError(
          error instanceof Error ? error.message : 'Unknown error while adding status page.',
        )
      } finally {
        setIsAddingPage(false)
      }
    },
    [addPageDraft, buildStoredPage, onPagesChange, pages],
  )

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

        const nextPages: StoredStatusPage[] = [...pages, buildStoredPage(detection, '')]

        saveStatusPages(nextPages)
        onPagesChange(nextPages)
      } catch (error) {
        setAddError(
          error instanceof Error ? error.message : 'Unknown error while adding status page.',
        )
      } finally {
        setIsAddingPage(false)
      }
    },
    [buildStoredPage, onPagesChange, pages],
  )

  const handleAddSample = useCallback(async () => {
    await addPageFromUrl('https://www.githubstatus.com')
  }, [addPageFromUrl])

  const handleQuickAddClick = useCallback(() => {
    setAddError(null)
    setUrlModalError(null)
    setAddFormError(null)
    setUrlDraft('https://')
    setIsUrlModalOpen(true)
  }, [])

  const cards = useMemo(
    () =>
      pages.map((page) => (
        <StatusCard
          key={page.id}
          page={page}
          status={statusByPageId[page.id] ?? getDefaultStatus()}
        />
      )),
    [pages, statusByPageId],
  )

  return (
    <main className="mx-auto w-full max-w-[1920px] p-6 md:p-8">
      <header className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-100">Integration Status Monitor</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleQuickAddClick}
            disabled={isPreparingAddFlow || isAddingPage}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#042416] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPreparingAddFlow || isAddingPage ? 'Adding...' : 'Add'}
          </button>
          <div className="flex items-center gap-3 rounded-xl border border-slate-500/30 bg-slate-800/30 px-4 py-2 text-slate-200">
            <span className="status-pulse h-3 w-3 rounded-full bg-emerald-300" aria-hidden="true" />
            <span className="text-lg font-medium">System Online</span>
            {isPolling ? <span className="text-sm text-slate-300/80">(Refreshing...)</span> : null}
          </div>
        </div>
      </header>

      {pages.length === 0 ? (
        <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-dashed border-slate-500/60 bg-[#141d1a]/70 p-10 text-center">
          <h2 className="text-4xl font-semibold text-slate-100">No monitoring configured</h2>
          <p className="mx-auto mt-4 max-w-lg text-xl text-slate-300">
            There are currently no active service monitors configured.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleQuickAddClick}
              disabled={isPreparingAddFlow || isAddingPage}
              className="rounded-xl bg-emerald-400 px-6 py-3 text-lg font-semibold text-[#042416] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add status page
            </button>
            <button
              type="button"
              onClick={() => {
                void handleAddSample()
              }}
              disabled={isAddingPage}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-3 text-lg font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Add Sample GitHub Status
            </button>
          </div>
          {addError ? <p className="mt-4 text-sm text-rose-300">{addError}</p> : null}
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3 2xl:grid-cols-4">{cards}</section>
          {addError ? <p className="mt-6 text-sm text-rose-300">{addError}</p> : null}
        </>
      )}

      <dialog
        ref={urlModalRef}
        className="editor-dialog w-[min(92vw,680px)] rounded-2xl border border-slate-700/80 bg-[#111915] p-0 text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        onCancel={(event) => {
          if (isPreparingAddFlow) {
            event.preventDefault()
            return
          }
          closeUrlModal()
        }}
        onClose={closeUrlModal}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeUrlModal()
          }
        }}
      >
        <div className="p-6 md:p-7">
          <h2 className="text-2xl font-semibold text-slate-100">Step 1: Enter URL</h2>
          <p className="mt-2 text-sm text-slate-300">
            Enter the status page URL. Then we will open the detailed form.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleUrlDraftSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="status-page-url-draft">
                Status page URL
              </label>
              <input
                id="status-page-url-draft"
                type="url"
                value={urlDraft}
                onChange={(event) => setUrlDraft(event.target.value)}
                placeholder="https://www.githubstatus.com"
                className="w-full rounded-xl border border-slate-600/80 bg-[#0f1714] px-4 py-3 text-lg text-slate-100 outline-none transition focus:border-emerald-400"
                required
                autoFocus
              />
            </div>

            {urlModalError ? <p className="text-sm font-medium text-rose-300">{urlModalError}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isPreparingAddFlow}
                className="rounded-xl bg-emerald-400 px-5 py-3 text-base font-semibold uppercase tracking-[0.08em] text-[#042416] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPreparingAddFlow ? 'Validating...' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={closeUrlModal}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-300 transition hover:border-slate-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog
        ref={addFormModalRef}
        className="editor-dialog w-[min(96vw,760px)] rounded-2xl border border-slate-700/80 bg-[#111915] p-0 text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        onCancel={(event) => {
          if (isAddingPage) {
            event.preventDefault()
            return
          }
          closeAddFormModal()
        }}
        onClose={closeAddFormModal}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeAddFormModal()
          }
        }}
      >
        <div className="p-6 md:p-7">
          <h2 className="text-2xl font-semibold text-slate-100">Step 2: Detailed settings</h2>
          <p className="mt-2 text-sm text-slate-300">Adjust the name or URL and save.</p>
          {addPageDraft ? (
            <div className="mt-5">
              <StatusPageForm
                key={addPageDraft.detection.baseUrl}
                initialValues={{
                  name: addPageDraft.initialName,
                  url: addPageDraft.detection.baseUrl,
                }}
                isSubmitting={isAddingPage}
                errorMessage={addFormError}
                submitLabel="Add status page"
                onSubmit={handleAddFormSubmit}
                onCancel={closeAddFormModal}
              />
            </div>
          ) : null}
        </div>
      </dialog>
    </main>
  )
}
