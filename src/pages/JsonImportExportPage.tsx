import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  formatStatusSettingsExport,
  parseStatusSettingsImport,
} from '../services/localStorageStatusPages'
import type { StoredStatusPage } from '../types/status'

type JsonImportExportPageProps = {
  pages: StoredStatusPage[]
  onPagesChange: (pages: StoredStatusPage[]) => void
}

export function JsonImportExportPage({ pages, onPagesChange }: JsonImportExportPageProps) {
  const [jsonText, setJsonText] = useState(() => formatStatusSettingsExport(pages))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const exportJson = useMemo(() => formatStatusSettingsExport(pages), [pages])

  const handleDownloadExport = () => {
    const fileName = `status-monitor-settings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    const blob = new Blob([exportJson], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleResetToCurrentState = () => {
    setJsonText(exportJson)
    setErrorMessage(null)
    setSuccessMessage('Textarea reloaded with current settings state.')
  }

  const handleSaveFromTextarea = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const nextPages = parseStatusSettingsImport(jsonText)
      const formatted = formatStatusSettingsExport(nextPages)

      onPagesChange(nextPages)
      setJsonText(formatted)
      setSuccessMessage(
        `Saved. ${nextPages.length} status page${nextPages.length === 1 ? '' : 's'} loaded.`,
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] p-8 md:p-10">
      <header className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight text-slate-100">JSON Import / Export</h1>
          <p className="mt-3 text-2xl text-slate-300">
            Export or import the full settings state as formatted JSON.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/settings"
            className="inline-flex items-center justify-center rounded-xl bg-slate-700/80 px-6 py-3 text-xl font-semibold text-slate-200 transition hover:bg-slate-600"
          >
            Back to Settings
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-6 py-3 text-xl font-semibold text-slate-200 transition hover:border-slate-400"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-700/70 bg-[#141d1a]/90 p-6 shadow-[0_16px_45px_rgba(0,0,0,0.35)]">
        <h2 className="text-3xl font-semibold text-slate-100">JSON State</h2>
        <p className="mt-2 text-sm text-slate-400">
          This single textarea is used for both export and import. Edit JSON and click Save.
        </p>
        <textarea
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          className="mt-4 h-[620px] w-full rounded-xl border border-slate-700 bg-[#0f1714] p-3 font-mono text-xs text-slate-200 outline-none focus:border-emerald-400"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSaveFromTextarea}
            disabled={isSaving}
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#042416] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleResetToCurrentState}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
          >
            Reload current state
          </button>
          <button
            type="button"
            onClick={handleDownloadExport}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Download JSON
          </button>
        </div>
        {errorMessage ? <p className="mt-3 text-sm text-rose-300">{errorMessage}</p> : null}
        {successMessage ? <p className="mt-3 text-sm text-emerald-300">{successMessage}</p> : null}
      </section>
    </main>
  )
}
