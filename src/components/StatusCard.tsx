import type { RuntimeStatus, StoredStatusPage } from '../types/status'

type StatusPresentation = {
  toneClass: string
  borderClass: string
  badgeClass: string
  label: string
}

const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  none: {
    toneClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/30',
    badgeClass: 'bg-emerald-500/25',
    label: 'Operational',
  },
  minor: {
    toneClass: 'text-amber-300',
    borderClass: 'border-amber-500/30',
    badgeClass: 'bg-amber-500/25',
    label: 'Degraded performance',
  },
  major: {
    toneClass: 'text-orange-300',
    borderClass: 'border-orange-500/30',
    badgeClass: 'bg-orange-500/25',
    label: 'Partial outage',
  },
  critical: {
    toneClass: 'text-red-300',
    borderClass: 'border-red-500/30',
    badgeClass: 'bg-red-500/25',
    label: 'Major outage',
  },
  unknown: {
    toneClass: 'text-slate-300',
    borderClass: 'border-slate-500/30',
    badgeClass: 'bg-slate-500/20',
    label: 'Unknown',
  },
}

function formatTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) {
    return 'Not yet'
  }

  const parsed = new Date(isoTimestamp)

  if (Number.isNaN(parsed.valueOf())) {
    return 'Unknown'
  }

  return parsed.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatComponentStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

type StatusCardProps = {
  page: StoredStatusPage
  status: RuntimeStatus
  onOpenSettings?: () => void
}

export function StatusCard({ page, status, onOpenSettings }: StatusCardProps) {
  const presentation = STATUS_PRESENTATION[status.indicator] ?? STATUS_PRESENTATION.unknown
  const isClickable = typeof onOpenSettings === 'function'

  return (
    <article
      className={`rounded-2xl border bg-[#141d1a]/90 p-6 shadow-[0_16px_45px_rgba(0,0,0,0.35)] transition-colors ${presentation.borderClass} ${
        isClickable ? 'cursor-pointer hover:border-emerald-400/50' : ''
      }`}
      onClick={onOpenSettings}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(event) => {
        if (!isClickable) {
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenSettings?.()
        }
      }}
    >
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-3xl font-semibold text-slate-100">{page.name}</h3>
          <p className="mt-2 inline-block rounded-md bg-[#101815] px-2 py-1 font-mono text-sm text-slate-400">
            {page.url}
          </p>
        </div>
        <div className={`rounded-full p-3 ${presentation.badgeClass}`}>
          <div className="h-4 w-4 rounded-full bg-current text-transparent" aria-hidden="true" />
        </div>
      </header>

      <div className="mb-8 flex min-h-24 items-center gap-4">
        <div className={`h-16 w-3 rounded-full ${presentation.badgeClass}`} aria-hidden="true" />
        {status.isLoading ? (
          <div className="space-y-3">
            <div className="h-7 w-48 animate-pulse rounded bg-slate-700/50" />
            <div className="h-5 w-64 animate-pulse rounded bg-slate-700/30" />
          </div>
        ) : (
          <div>
            <p className={`text-4xl font-semibold leading-tight ${presentation.toneClass}`}>{presentation.label}</p>
            <p className="mt-1 text-xl text-slate-300">{status.description}</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-700/70 pt-4 text-sm text-slate-300">
        <div className="flex items-center justify-between gap-4">
          <span>Last successful fetch: {formatTime(status.lastSuccessfulAt)}</span>
          {status.latencyMs !== null ? <span>{status.latencyMs}ms</span> : <span>-</span>}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Relevant components: {page.monitoredComponentIds.length > 0 ? page.monitoredComponentIds.length : 'all'}
        </p>
        {status.degradedComponents.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-200">
              Degraded Components
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-100">
              {status.degradedComponents.map((component) => (
                <li key={component.id}>
                  {component.name}: {formatComponentStatus(component.status)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {status.error ? <p className="mt-3 text-sm text-rose-300">Error: {status.error}</p> : null}
      </div>
    </article>
  )
}
