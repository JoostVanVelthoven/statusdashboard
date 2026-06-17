import { describe, expect, it } from 'vitest'
import { summarizeStatusIndicators } from '../../src/services/summarizeStatusIndicators'

describe('summarizeStatusIndicators', () => {
  it('counts every status page with a degraded or worse indicator', () => {
    expect(
      summarizeStatusIndicators(['none', 'minor', 'major', 'critical', 'unknown']),
    ).toEqual({
      incidentPageCount: 3,
      overallIndicator: 'critical',
    })
  })

  it('returns no incidents when all known status pages are operational', () => {
    expect(summarizeStatusIndicators(['none', 'none'])).toEqual({
      incidentPageCount: 0,
      overallIndicator: 'none',
    })
  })

  it('returns an unknown summary when no status page result is available', () => {
    expect(summarizeStatusIndicators([])).toEqual({
      incidentPageCount: 0,
      overallIndicator: 'unknown',
    })
  })
})
