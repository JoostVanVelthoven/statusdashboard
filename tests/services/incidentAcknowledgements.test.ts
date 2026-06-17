import { describe, expect, it } from 'vitest'
import {
  acknowledgeIncident,
  countUnacknowledgedIncidents,
  reconcileIncidentAcknowledgements,
} from '../../src/services/incidentAcknowledgements'

describe('incident acknowledgements', () => {
  it('removes a hovered incident page from the notification count', () => {
    const indicators = { api: 'major', website: 'minor' } as const
    const acknowledged = acknowledgeIncident({}, 'api', indicators.api)

    expect(countUnacknowledgedIncidents(indicators, acknowledged)).toBe(1)
  })

  it('shows an acknowledged page again when its incident escalates', () => {
    const acknowledged = { api: 'minor' } as const
    const indicators = { api: 'major' } as const
    const reconciled = reconcileIncidentAcknowledgements(acknowledged, indicators)

    expect(reconciled).toEqual({})
    expect(countUnacknowledgedIncidents(indicators, reconciled)).toBe(1)
  })

  it('keeps a de-escalated incident acknowledged until it resolves', () => {
    const acknowledged = { api: 'major' } as const
    const indicators = { api: 'minor' } as const
    const reconciled = reconcileIncidentAcknowledgements(acknowledged, indicators)

    expect(reconciled).toEqual(acknowledged)
    expect(countUnacknowledgedIncidents(indicators, reconciled)).toBe(0)
  })

  it('keeps an acknowledgement through unknown or temporarily missing results', () => {
    expect(reconcileIncidentAcknowledgements({ api: 'major' }, { api: 'unknown' })).toEqual({
      api: 'major',
    })
    expect(reconcileIncidentAcknowledgements({ api: 'major' }, {})).toEqual({ api: 'major' })
  })

  it('shows a new incident after the previous incident resolved', () => {
    const resolvedAcknowledgements = reconcileIncidentAcknowledgements(
      { api: 'major' },
      { api: 'none' },
    )

    expect(resolvedAcknowledgements).toEqual({})
    expect(countUnacknowledgedIncidents({ api: 'minor' }, resolvedAcknowledgements)).toBe(1)
  })

  it('does not acknowledge operational or unknown pages', () => {
    expect(acknowledgeIncident({}, 'api', 'none')).toEqual({})
    expect(acknowledgeIncident({}, 'api', 'unknown')).toEqual({})
  })
})
