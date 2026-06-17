type BadgeNavigator = {
  clearAppBadge?: () => Promise<void>
  setAppBadge?: (contents?: number) => Promise<void>
}

export async function updateAppBadge(
  incidentPageCount: number,
  badgeNavigator: BadgeNavigator = navigator,
): Promise<void> {
  if (incidentPageCount > 0) {
    await badgeNavigator.setAppBadge?.(incidentPageCount)
    return
  }

  await badgeNavigator.clearAppBadge?.()
}
