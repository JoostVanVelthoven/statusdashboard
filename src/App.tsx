import { useMemo, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { StatusDashboard } from './components/StatusDashboard'
import { loadStatusPages, saveStatusPages } from './services/localStorageStatusPages'
import { JsonImportExportPage } from './pages/JsonImportExportPage'
import { SettingsPage } from './pages/SettingsPage'
import type { StoredStatusPage } from './types/status'

function formatRelativeRefresh(lastRefreshAt: Date | null): string {
  if (!lastRefreshAt) {
    return 'Not refreshed yet'
  }

  const now = Date.now()
  const elapsedSeconds = Math.max(0, Math.floor((now - lastRefreshAt.getTime()) / 1000))

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s ago`
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  return `${elapsedHours}h ago`
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
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const location = useLocation()

  const isDashboardRoute = location.pathname === '/'
  const isSettingsRoute = location.pathname === '/settings'
  const isJsonRoute = location.pathname === '/settings-json'

  const refreshLabel = useMemo(() => formatRelativeRefresh(lastRefreshAt), [lastRefreshAt])

  const handlePagesChange = (nextPages: StoredStatusPage[]) => {
    setPages(nextPages)
    saveStatusPages(nextPages)
  }

  return (
    <div className="min-h-screen bg-[#0e1511] text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-[#020826]/95 shadow-lg shadow-black/20 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between px-8 py-4 md:px-10">
          <div className="flex items-center gap-8">
            <span className="text-4xl font-bold tracking-tight text-white">Sentinel NOC</span>
            <div className="hidden items-center gap-6 md:flex">
              <NavLink to="/" label="Dashboard" isActive={isDashboardRoute} />
              <NavLink to="/settings" label="Settings" isActive={isSettingsRoute} />
              <NavLink to="/settings-json" label="JSON" isActive={isJsonRoute} />
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <span className="hidden text-xl md:block">Refreshed: {refreshLabel}</span>
            <button
              type="button"
              className="rounded-md p-2 transition hover:bg-slate-800/70"
              onClick={() => setRefreshToken((current) => current + 1)}
              title="Refresh now"
            >
              ↻
            </button>
            <Link to="/settings" className="rounded-md p-2 transition hover:bg-slate-800/70" title="Settings">
              ⚙
            </Link>
          </div>
        </div>
      </nav>

      <Routes>
        <Route
          path="/"
          element={
            <StatusDashboard
              pages={pages}
              refreshToken={refreshToken}
              onPagesChange={handlePagesChange}
              onLastRefreshChange={setLastRefreshAt}
            />
          }
        />
        <Route path="/settings" element={<SettingsPage pages={pages} onPagesChange={handlePagesChange} />} />
        <Route
          path="/settings-json"
          element={<JsonImportExportPage pages={pages} onPagesChange={handlePagesChange} />}
        />
      </Routes>
    </div>
  )
}
