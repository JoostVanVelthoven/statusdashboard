import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { StatusPageForm } from '../components/StatusPageForm'
import { detectStatusPageProvider } from '../services/detectStatusPageProvider'
import { saveStatusPages } from '../services/localStorageStatusPages'
import type { StatusPageComponentOption, StoredStatusPage } from '../types/status'

type SettingsPageProps = {
  pages: StoredStatusPage[]
  onPagesChange: (pages: StoredStatusPage[]) => void
}

type FormValues = {
  name: string
  url: string
}

type SettingsLocationState = {
  editPageId?: string
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

export function SettingsPage({ pages, onPagesChange }: SettingsPageProps) {
  const location = useLocation()
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoadingComponents, setIsLoadingComponents] = useState(false)
  const [componentsError, setComponentsError] = useState<string | null>(null)
  const [availableComponents, setAvailableComponents] = useState<StatusPageComponentOption[]>([])
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([])

  const editingPage = useMemo(
    () => pages.find((page) => page.id === editingPageId) ?? null,
    [editingPageId, pages],
  )

  const applyPages = (nextPages: StoredStatusPage[]) => {
    saveStatusPages(nextPages)
    onPagesChange(nextPages)
  }

  const handleSubmit = async (values: FormValues) => {
    setFormError(null)
    setIsSubmitting(true)

    try {
      const detection = await detectStatusPageProvider(values.url)
      const now = new Date().toISOString()
      const nextName = values.name.trim() || detection.name?.trim() || new URL(detection.baseUrl).hostname
      const duplicate = pages.find((page) => page.url === detection.baseUrl && page.id !== editingPage?.id)

      if (duplicate) {
        throw new Error('This status page already exists in the configuration.')
      }

      const discoveredComponentIds = detection.availableComponents.map((component) => component.id)

      const monitoredComponentIds = editingPage
        ? selectedComponentIds.filter((componentId) => discoveredComponentIds.includes(componentId))
        : discoveredComponentIds

      if (editingPage && detection.availableComponents.length > 0 && monitoredComponentIds.length === 0) {
        throw new Error('Select at least 1 relevant component.')
      }

      const nextPage: StoredStatusPage = {
        id: editingPage?.id ?? crypto.randomUUID(),
        name: nextName,
        url: detection.baseUrl,
        provider: detection.provider,
        statusApiUrl: detection.statusApiUrl,
        summaryApiUrl: detection.summaryApiUrl,
        monitoredComponentIds,
        createdAt: editingPage?.createdAt ?? now,
        updatedAt: now,
      }

      const nextPages = editingPage
        ? pages.map((page) => (page.id === editingPage.id ? nextPage : page))
        : [...pages, nextPage]

      applyPages(nextPages)
      setEditingPageId(null)
      setAvailableComponents([])
      setSelectedComponentIds([])
      setComponentsError(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unknown error while saving page.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (pageId: string) => {
    const shouldDelete = window.confirm('Are you sure you want to delete this status page?')

    if (!shouldDelete) {
      return
    }

    const nextPages = pages.filter((page) => page.id !== pageId)

    applyPages(nextPages)

    if (editingPageId === pageId) {
      setEditingPageId(null)
      setAvailableComponents([])
      setSelectedComponentIds([])
      setComponentsError(null)
    }
  }

  const handleAddSample = async () => {
    if (isSubmitting) {
      return
    }

    setFormError(null)
    setIsSubmitting(true)

    try {
      const detection = await detectStatusPageProvider('https://status.cyso.com')
      const alreadyExists = pages.some((page) => page.url === detection.baseUrl)

      if (alreadyExists) {
        throw new Error('Sample URL already exists in the list.')
      }

      const now = new Date().toISOString()
      const hostname = new URL(detection.baseUrl).hostname

      const nextPages: StoredStatusPage[] = [
        ...pages,
        {
          id: crypto.randomUUID(),
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

      applyPages(nextPages)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to add sample.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = useCallback(async (page: StoredStatusPage) => {
    setEditingPageId(page.id)
    setFormError(null)
    setComponentsError(null)
    setIsLoadingComponents(true)

    try {
      if (!page.summaryApiUrl) {
        setAvailableComponents([])
        setSelectedComponentIds([])
        setComponentsError('No summary.json endpoint is available for this page.')
        return
      }

      const detection = await detectStatusPageProvider(page.url)
      const componentIds = detection.availableComponents.map((component) => component.id)
      const selected = page.monitoredComponentIds.filter((componentId) => componentIds.includes(componentId))

      setAvailableComponents(detection.availableComponents)
      setSelectedComponentIds(selected.length > 0 ? selected : componentIds)
    } catch (error) {
      setAvailableComponents([])
      setSelectedComponentIds([])
      setComponentsError(
        error instanceof Error ? error.message : 'Could not load components from summary.json.',
      )
    } finally {
      setIsLoadingComponents(false)
    }
  }, [])

  const toggleComponent = (componentId: string) => {
    setSelectedComponentIds((previous) =>
      previous.includes(componentId)
        ? previous.filter((id) => id !== componentId)
        : [...previous, componentId],
    )
  }

  useEffect(() => {
    const routeState = location.state as SettingsLocationState | null
    const routeEditPageId = routeState?.editPageId

    if (!routeEditPageId || editingPageId === routeEditPageId) {
      return
    }

    const pageToEdit = pages.find((page) => page.id === routeEditPageId)

    if (!pageToEdit) {
      return
    }

    void handleEdit(pageToEdit)
  }, [editingPageId, handleEdit, location.state, pages])

  return (
    <main className="mx-auto w-full max-w-[1720px] p-8 md:p-10">
      <header className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight text-slate-100">Settings</h1>
          <p className="mt-3 text-2xl text-slate-300">Manage your status monitors and external source configuration.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/settings-json"
            className="inline-flex items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-3 text-xl font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            JSON Import/Export
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-slate-700/80 px-6 py-3 text-xl font-semibold text-slate-200 transition hover:bg-slate-600"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="space-y-6 xl:col-span-5">
          <div className="rounded-2xl border border-slate-700/70 bg-[#141d1a]/90 p-6 shadow-[0_16px_45px_rgba(0,0,0,0.35)]">
            <h2 className="mb-6 text-4xl font-semibold text-slate-100">
              {editingPage ? 'Edit Status Page' : 'Add Status Page'}
            </h2>
            <StatusPageForm
              key={editingPage?.id ?? 'create'}
              initialValues={
                editingPage
                  ? {
                      name: editingPage.name,
                      url: editingPage.url,
                    }
                  : undefined
              }
              isSubmitting={isSubmitting}
              errorMessage={formError}
              submitLabel={editingPage ? 'Save Changes' : 'Add Page'}
              onSubmit={(values) => {
                void handleSubmit(values)
              }}
              onCancel={
                editingPage
                  ? () => {
                      setEditingPageId(null)
                      setFormError(null)
                      setComponentsError(null)
                      setAvailableComponents([])
                      setSelectedComponentIds([])
                    }
                  : undefined
              }
              onAddSample={() => {
                void handleAddSample()
              }}
            />
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-[#141d1a]/90 p-6 shadow-[0_16px_45px_rgba(0,0,0,0.35)]">
            <h3 className="text-2xl font-semibold text-slate-100">Key Components</h3>
            {!editingPage ? (
              <p className="mt-3 text-sm text-slate-400">Click Edit on an existing page first to choose relevant components.</p>
            ) : null}
            {isLoadingComponents ? <p className="mt-3 text-sm text-slate-300">Loading components...</p> : null}
            {componentsError ? <p className="mt-3 text-sm text-rose-300">{componentsError}</p> : null}
            {editingPage && !isLoadingComponents && availableComponents.length === 0 && !componentsError ? (
              <p className="mt-3 text-sm text-slate-400">No components found in summary.json for this page.</p>
            ) : null}
            {editingPage && availableComponents.length > 0 ? (
              <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
                {availableComponents.map((component) => (
                  <label
                    key={component.id}
                    className="flex items-center justify-between rounded-lg border border-slate-700 bg-[#0f1714] px-3 py-2 text-sm text-slate-200"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedComponentIds.includes(component.id)}
                        onChange={() => toggleComponent(component.id)}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-400"
                      />
                      <span>{component.name}</span>
                    </span>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${getComponentTone(component.status)}`}>
                      {component.status}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {editingPage && availableComponents.length > 0 ? (
              <p className="mt-3 text-xs text-slate-400">
                Only checked components determine the status color on the dashboard.
              </p>
            ) : null}
          </div>

        </section>

        <section className="xl:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-[#141d1a]/90 shadow-[0_16px_45px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between border-b border-slate-700/70 p-6">
              <h2 className="text-4xl font-semibold text-slate-100">Manage Pages</h2>
              <span className="rounded-full bg-slate-700/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                {pages.length} active
              </span>
            </div>

            {pages.length === 0 ? (
              <div className="p-6 text-slate-300">No status pages stored yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-slate-800/70 text-xs uppercase tracking-[0.08em] text-slate-300">
                    <tr>
                      <th className="p-4">Name / Provider</th>
                      <th className="p-4">Endpoint</th>
                      <th className="p-4">Relevant components</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/70">
                    {pages.map((page) => (
                      <tr key={page.id} className="bg-[#141d1a]/60 text-slate-100 transition hover:bg-[#1b2622]">
                        <td className="p-4">
                          <p className="text-2xl font-semibold">{page.name}</p>
                          <p className="text-sm text-slate-400">Atlassian Provider</p>
                        </td>
                        <td className="p-4 font-mono text-sm text-slate-300">{new URL(page.statusApiUrl).hostname}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-2 rounded bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
                            {page.monitoredComponentIds.length} selected
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void handleEdit(page)
                              }}
                              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-200 transition hover:border-slate-400"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(page.id)}
                              className="rounded-lg border border-rose-500/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-rose-300 transition hover:bg-rose-500/20"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
