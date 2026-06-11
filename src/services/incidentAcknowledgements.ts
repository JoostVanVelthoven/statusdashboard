import type { AtlassianIndicator } from '../types/status'

export type IndicatorByPageId = Record<string, AtlassianIndicator>
export type AcknowledgedIndicatorByPageId = Record<string, AtlassianIndicator>

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

export function acknowledgeIncident(
  acknowledgedIndicators: AcknowledgedIndicatorByPageId,
  pageId: string,
  indicator: AtlassianIndicator,
): AcknowledgedIndicatorByPageId {
  if (indicatorSeverity(indicator) <= 0) {
    return acknowledgedIndicators
  }

  return {
    ...acknowledgedIndicators,
    [pageId]: indicator,
  }
}

export function reconcileIncidentAcknowledgements(
  acknowledgedIndicators: AcknowledgedIndicatorByPageId,
  indicatorsByPageId: IndicatorByPageId,
): AcknowledgedIndicatorByPageId {
  return Object.fromEntries(
    Object.entries(acknowledgedIndicators).filter(([pageId, acknowledgedIndicator]) => {
      const currentIndicator = indicatorsByPageId[pageId]

      if (currentIndicator === undefined || currentIndicator === 'unknown') {
        return true
      }

      return (
        indicatorSeverity(currentIndicator) > 0 &&
        indicatorSeverity(currentIndicator) <= indicatorSeverity(acknowledgedIndicator)
      )
    }),
  )
}

export function countUnacknowledgedIncidents(
  indicatorsByPageId: IndicatorByPageId,
  acknowledgedIndicators: AcknowledgedIndicatorByPageId,
): number {
  return Object.entries(indicatorsByPageId).filter(([pageId, indicator]) => {
    if (indicatorSeverity(indicator) <= 0) {
      return false
    }

    const acknowledgedIndicator = acknowledgedIndicators[pageId]
    return (
      acknowledgedIndicator === undefined ||
      indicatorSeverity(indicator) > indicatorSeverity(acknowledgedIndicator)
    )
  }).length
}
