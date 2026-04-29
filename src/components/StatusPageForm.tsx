import { useState } from 'react'

type StatusPageFormValues = {
  name: string
  url: string
}

type StatusPageFormProps = {
  initialValues?: StatusPageFormValues
  isSubmitting: boolean
  errorMessage: string | null
  submitLabel: string
  onSubmit: (values: StatusPageFormValues) => void
  onCancel?: () => void
  onAddSample: () => void
}

function validateHttpsUrl(value: string): string | null {
  if (!value.trim()) {
    return 'URL is verplicht.'
  }

  try {
    const parsed = new URL(value.trim())

    if (parsed.protocol !== 'https:') {
      return 'Gebruik een HTTPS URL.'
    }
  } catch {
    return 'Ongeldig URL-formaat. Gebruik een volledige HTTPS link.'
  }

  return null
}

export function StatusPageForm({
  initialValues,
  isSubmitting,
  errorMessage,
  submitLabel,
  onSubmit,
  onCancel,
  onAddSample,
}: StatusPageFormProps) {
  const [name, setName] = useState(() => initialValues?.name ?? '')
  const [url, setUrl] = useState(() => initialValues?.url ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const urlError = validateHttpsUrl(url)

    if (urlError) {
      setValidationError(urlError)
      return
    }

    setValidationError(null)
    onSubmit({
      name,
      url,
    })
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="status-page-name">
          Naam (optioneel)
        </label>
        <input
          id="status-page-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Bijv. Cyso"
          className="w-full rounded-xl border border-slate-600/80 bg-[#0f1714] px-4 py-3 text-lg text-slate-100 outline-none transition focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="status-page-url">
          Page URL
        </label>
        <input
          id="status-page-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://status.cyso.com"
          className="w-full rounded-xl border border-slate-600/80 bg-[#0f1714] px-4 py-3 text-lg text-slate-100 outline-none transition focus:border-emerald-400"
          required
        />
        <p className="mt-2 text-sm text-slate-400">Atlassian Statuspage wordt automatisch gedetecteerd via `/api/v2/status.json`.</p>
      </div>

      {validationError ? <p className="text-sm font-medium text-rose-300">{validationError}</p> : null}
      {errorMessage ? <p className="text-sm font-medium text-rose-300">{errorMessage}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-emerald-400 px-5 py-3 text-base font-semibold uppercase tracking-[0.08em] text-[#042416] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Valideren...' : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-300 transition hover:border-slate-400"
          >
            Annuleren
          </button>
        ) : null}
        <button
          type="button"
          onClick={onAddSample}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
        >
          + Sample Cyso Status Toevoegen
        </button>
      </div>
    </form>
  )
}
