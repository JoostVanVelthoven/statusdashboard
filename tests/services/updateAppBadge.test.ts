import { describe, expect, it, vi } from 'vitest'
import { updateAppBadge } from '../../src/services/updateAppBadge'

describe('updateAppBadge', () => {
  it.each([1, 2, 5])('sets the number of incident pages as the badge value: %s', async (count) => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined)
    const clearAppBadge = vi.fn().mockResolvedValue(undefined)

    await updateAppBadge(count, { clearAppBadge, setAppBadge })

    expect(setAppBadge).toHaveBeenCalledOnce()
    expect(setAppBadge).toHaveBeenCalledWith(count)
    expect(clearAppBadge).not.toHaveBeenCalled()
  })

  it.each([0, -1])('clears the badge when the incident page count is %s', async (count) => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined)
    const clearAppBadge = vi.fn().mockResolvedValue(undefined)

    await updateAppBadge(count, { clearAppBadge, setAppBadge })

    expect(clearAppBadge).toHaveBeenCalledOnce()
    expect(setAppBadge).not.toHaveBeenCalled()
  })

  it('does nothing when the Badging API is unsupported', async () => {
    await expect(updateAppBadge(2, {})).resolves.toBeUndefined()
    await expect(updateAppBadge(0, {})).resolves.toBeUndefined()
  })
})
