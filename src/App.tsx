import { useCallback, useEffect, useRef, useState } from 'react'
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
      className={`border-b-2 pb-1 text-2xl transition ${
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

  const handleShareDashboard = useCallback(async () => {
    if (pages.length === 0) {
      return
    }

    try {
      const hashPayload = await buildDashboardShareHash(pages)
      const shareUrl = new URL(window.location.href)
      shareUrl.pathname = '/'
      shareUrl.search = ''
      shareUrl.hash = hashPayload
      const shareLink = shareUrl.toString()

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareLink)
        return
      }

      window.prompt('Copy this dashboard share link:', shareLink)
    } catch (error) {
      console.error('[App] share dashboard failed', error)
    }
  }, [pages])

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

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
        <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between px-8 py-4 md:px-10">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4 md:gap-6">
              <NavLink to="/" label="Dashboard" isActive={isDashboardRoute} />
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <span className="hidden text-lg md:block">Refresh rate: 60s</span>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-1 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-800/70"
              onClick={() => {
                void handleShareDashboard()
              }}
              title="Share dashboard"
            >
              Share dashboard
            </button>
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
