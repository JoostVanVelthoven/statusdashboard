import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { StatusDashboard } from './components/StatusDashboard'
import { loadStatusPages, saveStatusPages } from './services/localStorageStatusPages'
import {
  buildDashboardShareHash,
  mergeResolvedSharedPages,
  parseDashboardShareHash,
} from './services/shareDashboard'
import { detectStatusPageProvider } from './services/detectStatusPageProvider'
import { JsonImportExportPage } from './pages/JsonImportExportPage'
import type { AtlassianIndicator, StoredStatusPage } from './types/status'



type ShareOption = 'copy' | 'native' | 'email' | 'whatsapp' | 'slack'

type MonitorChromeState = {
  color: string
  title: string
}

const DEFAULT_CHROME_STATE: MonitorChromeState = {
  color: '#38bdf8',
  title: 'Status Dashboard',
}

function getMonitorChromeState(indicator: AtlassianIndicator): MonitorChromeState {
  switch (indicator) {
    case 'none':
      return {
        color: '#22c55e',
        title: 'All systems operational',
      }
    case 'minor':
    case 'major':
      return {
        color: '#f59e0b',
        title: 'Service degradation detected',
      }
    case 'critical':
      return {
        color: '#ef4444',
        title: 'Major outage detected',
      }
    default:
      return {
        color: '#94a3b8',
        title: 'Status unknown',
      }
  }
}

function buildFaviconDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0b1220"/>
  <circle cx="32" cy="32" r="20" fill="${color}" />
  <circle cx="32" cy="32" r="10" fill="#0b1220" />
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}


function buildShareDashboardNamesText(pages: StoredStatusPage[]): string {
  const names = pages
    .map((page) => page.name.trim())
    .filter((name) => name.length > 0)

  if (names.length === 0) {
    return 'this dashboard'
  }

  if (names.length === 1) {
    return names[0]
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`
  }

  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function clearWindowHash(): void {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState(null, '', url.toString())
}

function NavLink({ to, label, isActive }: { to: string; label: string; isActive: boolean }) {
  return (
    <Link
      to={to}
      className={`border-b-2 pb-1 text-xl transition md:text-2xl ${
        isActive
          ? 'border-emerald-400 text-emerald-300'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
    </Link>
  )
}

export default function App() {
  const [pages, setPages] = useState<StoredStatusPage[]>(() => loadStatusPages())
  const [refreshToken, setRefreshToken] = useState(0)
  const [overallIndicator, setOverallIndicator] = useState<AtlassianIndicator>('unknown')
  const location = useLocation()
  const pagesRef = useRef(pages)
  const processedShareHashesRef = useRef(new Set<string>())

  const isDashboardRoute = location.pathname === '/'

  const handlePagesChange = useCallback((nextPages: StoredStatusPage[]) => {
    setPages(nextPages)
    saveStatusPages(nextPages)
  }, [])

  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const shareMenuRef = useRef<HTMLDivElement | null>(null)
  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const shareOptions = useMemo(() => {
    const options: { key: ShareOption; label: string }[] = [
      { key: 'copy', label: 'Copy link' },
      { key: 'email', label: 'Email' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'slack', label: 'Open Slack' },
    ]

    if (hasNativeShare) {
      options.splice(1, 0, { key: 'native', label: 'Share via phone' })
    }

    return options
  }, [hasNativeShare])

  const buildRawDashboardLink = useCallback(() => {
    const shareUrl = new URL(window.location.href)
    shareUrl.pathname = '/'
    shareUrl.search = ''
    shareUrl.hash = ''
    return shareUrl.toString()
  }, [])

  const buildShareLink = useCallback(async () => {
    const hashPayload = await buildDashboardShareHash(pages)
    const shareUrl = new URL(window.location.href)
    shareUrl.pathname = '/'
    shareUrl.search = ''
    shareUrl.hash = hashPayload
    return shareUrl.toString()
  }, [pages])

  const handleShareDashboard = useCallback(async (option: ShareOption) => {
    try {
      const shareLink = pages.length === 0 ? buildRawDashboardLink() : await buildShareLink()

      if (option === 'copy') {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(shareLink)
          return
        }

        window.prompt('Copy this dashboard share link:', shareLink)
        return
      }

      const dashboardNamesText = buildShareDashboardNamesText(pages)
      const shareText = `Want to know if ${dashboardNamesText} are sailing smooth? Use this dashboard: ${shareLink}`

      if (option === 'native') {
        if (hasNativeShare) {
          await navigator.share({
            title: 'Status Dashboard',
            text: shareText,
            url: shareLink,
          })
          return
        }

        window.prompt('Native share is not supported here. Copy this link:', shareLink)
        return
      }

      if (option === 'email') {
        const mailtoUrl = `mailto:?subject=${encodeURIComponent('Shared Status Dashboard')}&body=${encodeURIComponent(shareText)}`
        window.location.href = mailtoUrl
        return
      }

      if (option === 'whatsapp') {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
        return
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareLink)
      }

      window.open('slack://open', '_blank', 'noopener,noreferrer')
      window.open('https://app.slack.com/client', '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error('[App] share dashboard failed', error)
    }
  }, [buildRawDashboardLink, buildShareLink, hasNativeShare, pages.length])

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  useEffect(() => {
    if (!isShareMenuOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setIsShareMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsShareMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isShareMenuOpen])
  useEffect(() => {
    const rawHash = location.hash.trim()

    if (!rawHash || rawHash === '#') {
      return
    }

    if (processedShareHashesRef.current.has(rawHash)) {
      return
    }

    processedShareHashesRef.current.add(rawHash)

    const mergeSharedPages = async () => {
      let shouldClearHash = false

      try {
        const payload = await parseDashboardShareHash(rawHash)

        if (!payload) {
          return
        }

        shouldClearHash = true

        if (payload.pages.length === 0) {
          clearWindowHash()
          return
        }

        const resolvedPages = await Promise.all(
          payload.pages.map(async (page) => ({
            detection: await detectStatusPageProvider(page.url),
            selectionMode: page.selectionMode,
            monitoredComponentIds: page.monitoredComponentIds,
          })),
        )
        const mergeResult = mergeResolvedSharedPages(pagesRef.current, resolvedPages)

        if (mergeResult.hasChanges) {
          handlePagesChange(mergeResult.pages)
        }
      } catch (error) {
        shouldClearHash = true
        console.error('[App] invalid or failed dashboard share hash', error)
      } finally {
        if (shouldClearHash) {
          clearWindowHash()
        }
      }
    }

    void mergeSharedPages()
  }, [handlePagesChange, location.hash])

  useEffect(() => {
    if (pages.length > 0 && overallIndicator === 'unknown') {
      setOverallIndicator('none')
    }
  }, [overallIndicator, pages.length])

  useEffect(() => {
    const state = pages.length === 0 ? DEFAULT_CHROME_STATE : getMonitorChromeState(overallIndicator)
    document.title = state.title
    ;(window as Window & { title?: string }).title = state.title

    const faviconHref = buildFaviconDataUrl(state.color)
    const relValues = ['icon', 'shortcut icon']

    for (const rel of relValues) {
      let faviconLink = document.querySelector<HTMLLinkElement>(`link[rel=\"${rel}\"]`)

      if (!faviconLink) {
        faviconLink = document.createElement('link')
        faviconLink.rel = rel
        document.head.appendChild(faviconLink)
      }

      faviconLink.type = 'image/svg+xml'
      faviconLink.href = faviconHref
    }
  }, [overallIndicator, pages.length])

  return (
    <div className="flex min-h-screen flex-col bg-[#101512] text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0a1612]/90 shadow-md shadow-black/20 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:px-10">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4 md:gap-6">
              <NavLink to="/" label="Dashboard" isActive={isDashboardRoute} />
            </div>
          </div>

          <div className="flex w-full items-center justify-between gap-2 text-slate-300 md:w-auto md:justify-end md:gap-4">
            <span className="hidden text-lg lg:block">Refresh rate: 60s</span>
            <div className="relative" ref={shareMenuRef}>
              <button
                type="button"
                className="rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-800/70"
                onClick={() => setIsShareMenuOpen((current) => !current)}
                title="Share dashboard"
                aria-haspopup="menu"
                aria-expanded={isShareMenuOpen}
              >
                Share dashboard ▾
              </button>

              {isShareMenuOpen ? (
                <div
                  className="absolute right-0 mt-2 w-64 max-h-[min(20rem,calc(100vh-6rem))] overflow-y-auto overflow-x-hidden rounded-md border border-slate-700 bg-[#101e18] shadow-lg"
                  role="menu"
                >
                  {shareOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-800/80"
                      role="menuitem"
                      onClick={() => {
                        setIsShareMenuOpen(false)
                        void handleShareDashboard(option.key)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-md p-2 transition hover:bg-slate-800/70"
              onClick={() => setRefreshToken((current) => current + 1)}
              title="Refresh now"
            >
              ↻
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1">
        <Routes>
          <Route
            path="/"
            element={
              <StatusDashboard
                pages={pages}
                refreshToken={refreshToken}
                onPagesChange={handlePagesChange}
                onOverallIndicatorChange={setOverallIndicator}
              />
            }
          />
          <Route path="/settings" element={<Navigate to="/" replace />} />
          <Route
            path="/settings-json"
            element={<JsonImportExportPage pages={pages} onPagesChange={handlePagesChange} />}
          />
        </Routes>
      </div>

      <footer className="border-t border-slate-800/80 bg-[#0b1310]/80">
        <div className="mx-auto flex w-full max-w-[1920px] items-center justify-end px-8 py-3 md:px-10">
          <Link to="/settings-json" className="text-sm text-slate-400 transition hover:text-slate-200">
            JSON Import/Export
          </Link>
        </div>
      </footer>
    </div>
  )
}
