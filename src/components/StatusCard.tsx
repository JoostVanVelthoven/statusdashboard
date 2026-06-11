import type { RuntimeStatus, StoredStatusPage } from '../types/status'

type StatusPresentation = {
  label: string
  variantClass: string
}

const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  none: {
    label: 'Operational',
    variantClass: 'status-card--none',
  },
  minor: {
    label: 'Degraded performance',
    variantClass: 'status-card--minor',
  },
  major: {
    label: 'Partial outage',
    variantClass: 'status-card--major',
  },
  critical: {
    label: 'Major outage',
    variantClass: 'status-card--critical',
  },
  unknown: {
    label: 'Unknown',
    variantClass: 'status-card--unknown',
  },
}

function formatComponentStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

function trimLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1)}…`
}

function formatWindowDateTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) {
    return 'TBD'
  }

  const parsed = new Date(isoTimestamp)

  if (Number.isNaN(parsed.valueOf())) {
    return 'Unknown'
  }

  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMaintenanceWindow(start: string | null, end: string | null): string {
  if (!start && !end) {
    return 'Window TBD'
  }

  if (start && end) {
    return `${formatWindowDateTime(start)} - ${formatWindowDateTime(end)}`
  }

  if (start) {
    return `Starts ${formatWindowDateTime(start)}`
  }

  return `Until ${formatWindowDateTime(end)}`
}

type StatusCardProps = {
  page: StoredStatusPage
  status: RuntimeStatus
  onOpenSettings?: () => void
}

export function StatusCard({ page, status, onOpenSettings }: StatusCardProps) {
  const presentation = STATUS_PRESENTATION[status.indicator] ?? STATUS_PRESENTATION.unknown
  const isClickable = typeof onOpenSettings === 'function'
  const degradedPreview = status.degradedComponents.slice(0, 2)
  const hiddenDegradedCount = Math.max(0, status.degradedComponents.length - degradedPreview.length)
  const plannedPreview = [...status.plannedMaintenances]
    .sort((left, right) => {
      const leftTime = left.scheduledFor ? Date.parse(left.scheduledFor) : Number.POSITIVE_INFINITY
      const rightTime = right.scheduledFor ? Date.parse(right.scheduledFor) : Number.POSITIVE_INFINITY
      return leftTime - rightTime
    })
    .slice(0, 2)
  const hiddenPlannedCount = Math.max(0, status.plannedMaintenances.length - plannedPreview.length)

  return (
    <article
      className={`status-card ${presentation.variantClass} ${isClickable ? 'status-card--interactive' : ''}`}
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
      <header className="status-card__header">
        <h3 className="status-card__name">{page.name}</h3>
        <span className="status-card__signal" aria-hidden="true">
          <span className="status-card__signal-core" />
        </span>
      </header>

      <div className="status-card__body">
        <span className="status-card__rail" aria-hidden="true" />
        {status.isLoading ? (
          <div className="status-card__loading">
            <div className="status-card__skeleton status-card__skeleton--title" />
            <div className="status-card__skeleton status-card__skeleton--subtitle" />
          </div>
        ) : (
          <div className="status-card__content">
            <p className="status-card__headline">{presentation.label}</p>
            <p className="status-card__description">{status.description}</p>
            {status.degradedComponents.length > 0 ? (
              <div className="status-card__chips">
                {degradedPreview.map((component) => (
                  <span key={component.id} className="status-card__chip">
                    {trimLabel(component.name, 24)} · {formatComponentStatus(component.status)}
                  </span>
                ))}
                {hiddenDegradedCount > 0 ? (
                  <span className="status-card__chip status-card__chip--muted">+{hiddenDegradedCount} more</span>
                ) : null}
              </div>
            ) : null}
            {status.plannedMaintenances.length > 0 ? (
              <div className="status-card__planned-pill">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="status-card__planned-icon">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18" />
                </svg>
                <span>{status.plannedMaintenances.length} planned</span>
              </div>
            ) : null}
            <a
              className="status-card__page-link"
              href={page.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              Open status page
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
      </div>

      {status.plannedMaintenances.length > 0 ? (
        <div className="status-card__planned-flyout">
          <div className="status-card__planned-inner">
            <p className="status-card__planned-title">Planned maintenance</p>
            <ul className="status-card__planned-list">
              {plannedPreview.map((maintenance) => (
                <li key={maintenance.id} className="status-card__planned-item">
                  <p className="status-card__planned-item-name">{trimLabel(maintenance.name, 58)}</p>
                  <p className="status-card__planned-item-meta">
                    {formatMaintenanceWindow(maintenance.scheduledFor, maintenance.scheduledUntil)}
                  </p>
                </li>
              ))}
            </ul>
            {hiddenPlannedCount > 0 ? (
              <p className="status-card__planned-more">+{hiddenPlannedCount} more</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {status.error ? <p className="status-card__error">Error: {status.error}</p> : null}
    </article>
  )
}
