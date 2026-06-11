import type { AtlassianIndicator } from '../types/status'

export type StatusIndicatorSummary = {
  incidentPageCount: number
  overallIndicator: AtlassianIndicator
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

export function summarizeStatusIndicators(
  indicators: AtlassianIndicator[],
): StatusIndicatorSummary {
  return indicators.reduce<StatusIndicatorSummary>(
    (summary, indicator) => ({
      incidentPageCount:
        summary.incidentPageCount + (indicatorSeverity(indicator) > 0 ? 1 : 0),
      overallIndicator:
        indicatorSeverity(indicator) > indicatorSeverity(summary.overallIndicator)
          ? indicator
          : summary.overallIndicator,
    }),
    {
      incidentPageCount: 0,
      overallIndicator: 'unknown',
    },
  )
}
