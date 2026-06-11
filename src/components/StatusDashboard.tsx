import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { detectStatusPageProvider } from '../services/detectStatusPageProvider'
import { fetchStatusPageStatus } from '../services/fetchStatusPageStatus'
import { saveStatusPages } from '../services/localStorageStatusPages'
import { summarizeStatusIndicators } from '../services/summarizeStatusIndicators'
import { createId } from '../utils/createId'
import { StatusCard } from './StatusCard'
import { StatusPageForm } from './StatusPageForm'
import type {
  AtlassianIndicator,
  ProviderDetectionResult,
  RuntimeStatus,
  StatusPageComponentOption,
  StoredStatusPage,
} from '../types/status'

export type StatusDashboardHandle = {
  openAddPageDialog: () => void
}

type StatusDashboardProps = {
  pages: StoredStatusPage[]
  refreshToken: number
  onPagesChange: (pages: StoredStatusPage[]) => void
  onOverallIndicatorChange: (indicator: AtlassianIndicator, incidentPageCount: number) => void
}

type AddPageDraft = {
  detection: ProviderDetectionResult
  initialName: string
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

function getComponentTone(status: string): string {
  switch (status) {
    case 'operational':
      return 'bg-emerald-500/20 text-emerald-300'
    case 'degraded_performance':
    case 'under_maintenance':
      return 'bg-amber-500/20 text-amber-300'
    case 'partial_outage':
      return 'bg-orange-500/20 text-orange-300'
    case 'major_outage':
      return 'bg-rose-500/20 text-rose-300'
    default:
      return 'bg-slate-500/20 text-slate-300'
  }
}

function formatComponentStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

export const StatusDashboard = forwardRef<StatusDashboardHandle, StatusDashboardProps>(function StatusDashboard({
  pages,
  refreshToken,
  onPagesChange,
  onOverallIndicatorChange,
}, ref) {
  const [statusByPageId, setStatusByPageId] = useState<Record<string, RuntimeStatus>>({})
  const [addError, setAddError] = useState<string | null>(null)
  const [isAddingPage, setIsAddingPage] = useState(false)
  const [isPreparingAddFlow, setIsPreparingAddFlow] = useState(false)
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState('https://')
  const [urlModalError, setUrlModalError] = useState<string | null>(null)
  const [isAddFormModalOpen, setIsAddFormModalOpen] = useState(false)
  const [addFormError, setAddFormError] = useState<string | null>(null)
  const [addPageDraft, setAddPageDraft] = useState<AddPageDraft | null>(null)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editFormError, setEditFormError] = useState<string | null>(null)
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [isLoadingComponents, setIsLoadingComponents] = useState(false)
  const [componentsError, setComponentsError] = useState<string | null>(null)
  const [availableComponents, setAvailableComponents] = useState<StatusPageComponentOption[]>([])
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([])
  const [componentSearch, setComponentSearch] = useState('')
  const urlModalRef = useRef<HTMLDialogElement | null>(null)
  const addFormModalRef = useRef<HTMLDialogElement | null>(null)
  const editModalRef = useRef<HTMLDialogElement | null>(null)
  const editingPage = useMemo(
    () => pages.find((page) => page.id === editingPageId) ?? null,
    [editingPageId, pages],
  )
  const normalizedComponentSearch = componentSearch.trim().toLowerCase()
  const filteredComponents = useMemo(() => {
    if (!normalizedComponentSearch) {
      return availableComponents
    }

    return availableComponents.filter((component) => {
      const nameMatch = component.name.toLowerCase().includes(normalizedComponentSearch)
      const statusMatch = component.status.toLowerCase().includes(normalizedComponentSearch)
      return nameMatch || statusMatch
    })
  }, [availableComponents, normalizedComponentSearch])
  const allFilteredSelected =
    filteredComponents.length > 0 &&
    filteredComponents.every((component) => selectedComponentIds.includes(component.id))
  const hasFilteredSelection = filteredComponents.some((component) =>
    selectedComponentIds.includes(component.id),
  )

  const pollStatuses = useCallback(async () => {
    if (pages.length === 0) {
      setStatusByPageId({})
      onOverallIndicatorChange('unknown', 0)
      return
    }

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
    const fallbackTimestamp = new Date().toISOString()

    setStatusByPageId((previous) => {
      const next = { ...previous }

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

      return next
    })

    const statusSummary = summarizeStatusIndicators(
      result.flatMap((pageResult) =>
        pageResult.status === 'fulfilled' ? [pageResult.value.indicator] : [],
      ),
    )

    onOverallIndicatorChange(statusSummary.overallIndicator, statusSummary.incidentPageCount)
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

  useEffect(() => {
    const dialog = editModalRef.current

    if (!dialog) {
      return
    }

    if (isEditModalOpen) {
      if (!dialog.open) {
        dialog.showModal()
      }
      return
    }

    if (dialog.open) {
      dialog.close()
    }
  }, [isEditModalOpen])

  useEffect(() => {
    if (!isEditModalOpen || !editingPage) {
      return
    }

    let isCancelled = false

    const loadComponents = async () => {
      setIsLoadingComponents(true)
      setComponentsError(null)
      setComponentSearch('')

      try {
        const detection = await detectStatusPageProvider(editingPage.url)
        const components = detection.availableComponents

        if (isCancelled) {
          return
        }

        setAvailableComponents(components)

        const discoveredIds = components.map((component) => component.id)
        const retainedIds = editingPage.monitoredComponentIds.filter((componentId) =>
          discoveredIds.includes(componentId),
        )
        const nextSelectedIds =
          discoveredIds.length === 0
            ? []
            : retainedIds.length > 0
              ? retainedIds
              : discoveredIds

        setSelectedComponentIds(nextSelectedIds)
      } catch (error) {
        if (isCancelled) {
          return
        }

        setAvailableComponents([])
        setSelectedComponentIds([])
        setComponentsError(
          error instanceof Error ? error.message : 'Failed to load components for this status page.',
        )
      } finally {
        if (!isCancelled) {
          setIsLoadingComponents(false)
        }
      }
    }

    void loadComponents()

    return () => {
      isCancelled = true
    }
  }, [editingPage, isEditModalOpen])

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

  const closeEditModal = useCallback(() => {
    if (isEditingPage) {
      return
    }

    setIsEditModalOpen(false)
    setEditFormError(null)
    setEditingPageId(null)
    setIsLoadingComponents(false)
    setComponentsError(null)
    setAvailableComponents([])
    setSelectedComponentIds([])
    setComponentSearch('')
  }, [isEditingPage])

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

  const handleEditFormSubmit = useCallback(
    async (values: { name: string; url: string }) => {
      if (!editingPage) {
        setEditFormError('Status page no longer exists.')
        return
      }

      setEditFormError(null)
      setAddError(null)
      setIsEditingPage(true)

      try {
        const detection = await detectStatusPageProvider(values.url)
        const alreadyExists = pages.some(
          (page) => page.id !== editingPage.id && page.url === detection.baseUrl,
        )

        if (alreadyExists) {
          throw new Error('This status page is already in the list.')
        }

        const discoveredComponentIds = detection.availableComponents.map((component) => component.id)
        const selectedDiscoveredIds = selectedComponentIds.filter((componentId) =>
          discoveredComponentIds.includes(componentId),
        )
        if (discoveredComponentIds.length > 0 && selectedDiscoveredIds.length === 0) {
          throw new Error('Select at least 1 component.')
        }

        const monitoredComponentIds =
          discoveredComponentIds.length > 0 ? selectedDiscoveredIds : []
        const nextPage = buildStoredPage(detection, values.name)
        const updatedPage: StoredStatusPage = {
          ...nextPage,
          id: editingPage.id,
          createdAt: editingPage.createdAt,
          monitoredComponentIds,
        }
        const nextPages = pages.map((page) => (page.id === editingPage.id ? updatedPage : page))

        saveStatusPages(nextPages)
        onPagesChange(nextPages)
        setIsEditModalOpen(false)
        setEditingPageId(null)
      } catch (error) {
        setEditFormError(
          error instanceof Error ? error.message : 'Unknown error while saving status page.',
        )
      } finally {
        setIsEditingPage(false)
      }
    },
    [buildStoredPage, editingPage, onPagesChange, pages, selectedComponentIds],
  )

  const handleDeleteEditingPage = useCallback(() => {
    if (!editingPage || isEditingPage) {
      return
    }

    const shouldDelete = window.confirm('Delete this status page?')

    if (!shouldDelete) {
      return
    }

    const nextPages = pages.filter((page) => page.id !== editingPage.id)
    saveStatusPages(nextPages)
    onPagesChange(nextPages)
    setIsEditModalOpen(false)
    setEditingPageId(null)
    setEditFormError(null)
  }, [editingPage, isEditingPage, onPagesChange, pages])

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
    setEditFormError(null)
    setIsEditModalOpen(false)
    setEditingPageId(null)
    setIsAddFormModalOpen(false)
    setAddPageDraft(null)
    setUrlDraft('https://')
    setIsUrlModalOpen(true)
  }, [])

  const handleCardClick = useCallback((pageId: string) => {
    setAddError(null)
    setEditFormError(null)
    setIsUrlModalOpen(false)
    setIsAddFormModalOpen(false)
    setAddPageDraft(null)
    setComponentsError(null)
    setAvailableComponents([])
    setSelectedComponentIds([])
    setComponentSearch('')
    setEditingPageId(pageId)
    setIsEditModalOpen(true)
  }, [])

  useImperativeHandle(ref, () => ({
    openAddPageDialog: handleQuickAddClick,
  }), [handleQuickAddClick])

  const handleToggleComponentSelection = useCallback((componentId: string) => {
    setSelectedComponentIds((previous) =>
      previous.includes(componentId)
        ? previous.filter((value) => value !== componentId)
        : [...previous, componentId],
    )
  }, [])

  const handleSelectFilteredComponents = useCallback(() => {
    if (filteredComponents.length === 0) {
      return
    }

    setSelectedComponentIds((previous) => {
      const merged = new Set(previous)
      filteredComponents.forEach((component) => {
        merged.add(component.id)
      })
      return [...merged]
    })
  }, [filteredComponents])

  const handleDeselectFilteredComponents = useCallback(() => {
    if (filteredComponents.length === 0) {
      return
    }

    const filteredIds = new Set(filteredComponents.map((component) => component.id))
    setSelectedComponentIds((previous) => previous.filter((value) => !filteredIds.has(value)))
  }, [filteredComponents])

  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)

  const handleDragStart = useCallback((pageId: string) => {
    setDraggedPageId(pageId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedPageId(null)
  }, [])

  const handleDropOnPage = useCallback(
    (targetPageId: string) => {
      if (!draggedPageId || draggedPageId === targetPageId) {
        return
      }

      const fromIndex = pages.findIndex((page) => page.id === draggedPageId)
      const targetIndex = pages.findIndex((page) => page.id === targetPageId)

      if (fromIndex === -1 || targetIndex === -1) {
        return
      }

      const nextPages = [...pages]
      const [movedPage] = nextPages.splice(fromIndex, 1)
      nextPages.splice(targetIndex, 0, movedPage)

      saveStatusPages(nextPages)
      onPagesChange(nextPages)
      setDraggedPageId(null)
    },
    [draggedPageId, onPagesChange, pages],
  )

  const cards = useMemo(
    () =>
      pages.map((page) => (
        <div
          key={page.id}
          draggable
          onDragStart={() => handleDragStart(page.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(event) => {
            event.preventDefault()
          }}
          onDrop={() => handleDropOnPage(page.id)}
          className={`h-full cursor-grab active:cursor-grabbing ${
            draggedPageId === page.id ? 'opacity-60' : ''
          }`}
        >
          <StatusCard
            page={page}
            status={statusByPageId[page.id] ?? getDefaultStatus()}
            onOpenSettings={() => handleCardClick(page.id)}
          />
        </div>
      )),
    [draggedPageId, handleCardClick, handleDragEnd, handleDragStart, handleDropOnPage, pages, statusByPageId],
  )

  return (
    <main className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
      {pages.length === 0 ? (
        <section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-dashed border-slate-500/60 bg-[#141d1a]/70 p-6 text-center sm:mt-12 sm:p-10">
          <h2 className="text-3xl font-semibold text-slate-100 sm:text-4xl">No monitoring configured</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-slate-300 sm:text-xl">
            There are currently no active service monitors configured.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleQuickAddClick}
              disabled={isPreparingAddFlow || isAddingPage}
              className="w-full rounded-xl bg-emerald-400 px-6 py-3 text-base font-semibold text-[#042416] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-lg"
            >
              Add status page
            </button>
            <button
              type="button"
              onClick={() => {
                void handleAddSample()
              }}
              disabled={isAddingPage}
              className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-3 text-base font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-lg"
            >
              + Add Sample GitHub Status
            </button>
          </div>
          {addError ? <p className="mt-4 text-sm text-rose-300">{addError}</p> : null}
        </section>
      ) : (
        <>
          <section className="status-dashboard-grid">{cards}</section>
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

      <dialog
        ref={editModalRef}
        className="editor-dialog w-[min(96vw,760px)] rounded-2xl border border-slate-700/80 bg-[#111915] p-0 text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        onCancel={(event) => {
          if (isEditingPage) {
            event.preventDefault()
            return
          }
          closeEditModal()
        }}
        onClose={closeEditModal}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeEditModal()
          }
        }}
      >
        <div className="p-6 md:p-7">
          <h2 className="text-2xl font-semibold text-slate-100">Edit status page</h2>
          <p className="mt-2 text-sm text-slate-300">Update the name or URL and save changes.</p>
          {editingPage ? (
            <div className="mt-5 space-y-4">
              <StatusPageForm
                key={editingPage.id}
                initialValues={{
                  name: editingPage.name,
                  url: editingPage.url,
                }}
                isSubmitting={isEditingPage}
                errorMessage={editFormError}
                submitLabel="Save changes"
                onSubmit={handleEditFormSubmit}
                onCancel={closeEditModal}
              />
              <section className="rounded-xl border border-slate-700/80 bg-[#0f1714]/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-200">
                    Monitored components
                  </h3>
                  <span className="text-xs text-slate-400">
                    {selectedComponentIds.length}/{availableComponents.length} selected
                  </span>
                </div>

                {isLoadingComponents ? (
                  <p className="mt-3 text-sm text-slate-300">Loading components...</p>
                ) : componentsError ? (
                  <p className="mt-3 text-sm text-rose-300">{componentsError}</p>
                ) : availableComponents.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    No components available for this status page.
                  </p>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="search"
                        value={componentSearch}
                        onChange={(event) => setComponentSearch(event.target.value)}
                        placeholder="Search components"
                        className="min-w-[240px] flex-1 rounded-lg border border-slate-600/80 bg-[#0b1210] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400"
                      />
                      <button
                        type="button"
                        onClick={handleSelectFilteredComponents}
                        disabled={allFilteredSelected || filteredComponents.length === 0}
                        className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Select visible
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectFilteredComponents}
                        disabled={!hasFilteredSelection}
                        className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Clear visible
                      </button>
                    </div>

                    <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                      {filteredComponents.map((component) => {
                        const isSelected = selectedComponentIds.includes(component.id)

                        return (
                          <li key={component.id}>
                            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-700/80 bg-[#101814]/80 px-3 py-2 hover:border-slate-600">
                              <span className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleComponentSelection(component.id)}
                                  className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-400 focus:ring-emerald-400"
                                />
                                <span className="text-sm text-slate-100">{component.name}</span>
                              </span>
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${getComponentTone(component.status)}`}
                              >
                                {formatComponentStatus(component.status)}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </section>
              <div className="border-t border-slate-700/80 pt-4">
                <button
                  type="button"
                  onClick={handleDeleteEditingPage}
                  disabled={isEditingPage}
                  className="rounded-xl border border-rose-500/60 bg-rose-500/12 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete status page
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </dialog>
    </main>
  )
})
