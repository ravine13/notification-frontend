'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft, Bell, CalendarDays, Check, FileText, Home,
  Loader2, LogIn, LogOut, Map, Menu, Moon, Plus,
  Recycle, Search, Sun, Truck, UserCog, Users, X,
} from 'lucide-react'

import RoutesZones from '../components/Zones'
import Collections from '../components/Collections'
import Schedule from '../components/Schedules'
import RoutesResidents from '../components/Resident'
import RoutesNotifications from '../components/Notifications'
import Overview from '../components/Overview'
import RoutesUsers from '../components/Users'
import Reports from '../components/Reports'
import Trucks from '../components/Trucks'

// const API_URL = 'http://localhost:9123'
const API_URL = 'https://notification-system-tman.onrender.com'

type Role = 'admin' | 'staff'
type View =
    | 'Overview'
    | 'Collection schedules'
    | 'Routes & zones'
    | 'Trucks'
    | 'Residents'
    | 'Notifications'
    | 'Reports'
    | 'Users'

type RouteRecord = {
  id: number | string
  name: string
  truck?: string
  status?: string
  time?: string
}

type ToastType = 'success' | 'error' | 'info'
type ToastState = { message: string; type: ToastType } | null

type ActivityItem = { id: number; message: string; type: ToastType; time: string }
type ZoneLite = { id: number; name: string }
type TruckLite = { id: number; plateNumber: string; driverName?: string; model?: string }

const navItems: { label: View; icon: typeof Home; adminOnly?: boolean }[] = [
  { label: 'Overview', icon: Home },
  { label: 'Collection schedules', icon: CalendarDays },
  { label: 'Routes & zones', icon: Map },
  { label: 'Trucks', icon: Truck },
  { label: 'Residents', icon: Users },
  { label: 'Notifications', icon: Bell, adminOnly: true },
  { label: 'Reports', icon: FileText, adminOnly: true },
  { label: 'Users', icon: UserCog },
]

export default function Page() {

  const [authenticated, setAuthenticated] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [role, setRole] = useState<Role>('admin')
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')


  const [activeNav, setActiveNav] = useState<View>('Overview')
  const [dark, setDark] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const [routes, setRoutes] = useState<RouteRecord[]>([])


  const [now, setNow] = useState(new Date())
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [bellOpen, setBellOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [unread, setUnread] = useState(0)


  const [zones, setZones] = useState<ZoneLite[]>([])
  const [trucks, setTrucks] = useState<TruckLite[]>([])
  const [notifCounts, setNotifCounts] = useState({ failed: 0, pending: 0 })


  function notify(message: string, type: ToastType = 'success') {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 2600)
    setActivity((prev) =>
        [
          {
            id: Date.now(),
            message,
            type,
            time: new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev,
        ].slice(0, 20)
    )
    setUnread((n) => n + 1)
  }


  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem('theme')
    } catch {

    }
    const isDark = saved
        ? saved === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // ignore storage errors
    }
  }

  useEffect(() => {
    async function checkAuthentication() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
        })
        if (!response.ok) {
          setAuthenticated(false)
          return
        }
        const data = await response.json()
        const backendRole = String(data.role).toLowerCase()

        if (backendRole !== 'admin' && backendRole !== 'staff') {
          setAuthenticated(false)
          return
        }
        setRole(backendRole as Role)
        setUserName(data.name || '')
        setUserEmail(data.email || '')
        setAuthenticated(true)
      } catch (error) {
        console.error('Authentication check failed:', error)
        setAuthenticated(false)
      } finally {
        setAuthChecking(false)
      }
    }
    checkAuthentication()
  }, [])


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setBellOpen(false)
        setProfileOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])


  // Re-check the time every minute so the greeting and date stay right if the tab is left open
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])


  useEffect(() => {
    if (!authenticated) return
    const get = async (path: string) => {
      try {
        const r = await fetch(`${API_URL}${path}`, { credentials: 'include' })
        return r.ok ? await r.json() : []
      } catch {
        return []
      }
    }
    async function load() {
      const [z, t] = await Promise.all([get('/zones'), get('/trucks')])
      setZones(Array.isArray(z) ? z : [])
      setTrucks(Array.isArray(t) ? t : [])
      if (role === 'admin') {
        const n: { status: string }[] = await get('/notifications')
        const list = Array.isArray(n) ? n : []
        setNotifCounts({
          failed: list.filter((x) => x.status === 'FAILED').length,
          pending: list.filter((x) => x.status === 'PENDING').length,
        })
      }
    }
    void load()
  }, [authenticated, role])

  async function logout() {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setAuthenticated(false)
      setUserEmail('')
      setUserName('')
      setRole('admin')
      setActiveNav('Overview')
      setSidebarOpen(false)
      setRoutes([])
      setSearchOpen(false)
      setBellOpen(false)
      setProfileOpen(false)
      setActivity([])
      setUnread(0)
      setZones([])
      setTrucks([])
      setNotifCounts({ failed: 0, pending: 0 })
    }
  }

  const displayInitials = userName
      ? userName.trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
      : 'U'
  const firstName = userName ? userName.trim().split(/\s+/)[0] : 'there'
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const today = now.toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  if (authChecking) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#173a2e]">
          <div className="flex flex-col items-center gap-3 text-[#d8ed65]">
            <Loader2 className="animate-spin" size={28} />
            <p className="text-sm font-medium text-[#c1d2c7]">Checking your session…</p>
          </div>
        </div>
    )
  }

  if (!authenticated) {
    return (
        <LoginScreen
            onLogin={(loggedRole, email, name) => {
              setRole(loggedRole)
              setUserEmail(email)
              setUserName(name)
              setAuthenticated(true)
            }}
        />
    )
  }

  const isAdmin = role === 'admin'
  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin)


  const searchResults = (() => {
    const q = searchQuery.trim().toLowerCase()
    const pages = visibleNav
        .filter((n) => n.label.toLowerCase().includes(q))
        .map((n) => ({
          key: `p-${n.label}`,
          label: n.label === 'Users' && !isAdmin ? 'My Profile' : n.label,
          hint: 'Page',
          Icon: n.icon,
          go: n.label as View,
        }))
    if (!q) return pages
    const zoneHits = zones
        .filter((z) => z.name?.toLowerCase().includes(q))
        .map((z) => ({
          key: `z-${z.id}`,
          label: z.name,
          hint: 'Zone',
          Icon: Map,
          go: 'Routes & zones' as View,
        }))
    const truckHits = trucks
        .filter((t) => [t.plateNumber, t.driverName, t.model].some((v) => v?.toLowerCase().includes(q)))
        .map((t) => ({
          key: `t-${t.id}`,
          label: `${t.plateNumber}${t.driverName ? ` · ${t.driverName}` : ''}`,
          hint: 'Truck',
          Icon: Truck,
          go: 'Trucks' as View,
        }))
    return [...pages, ...zoneHits, ...truckHits]
  })()

  return (
      <div>
        <div className="min-h-screen bg-background text-foreground transition-colors">
          <aside className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col bg-[#173a2e] px-5 py-6 text-white transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center gap-3 px-2">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#d8ed65] text-[#173a2e]"><Recycle size={23} /></div>
              <div>
                <p className="text-lg font-semibold">Waste Track</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#b6cbbd]">Kenya · Eldoret</p>
              </div>
              <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X /></button>
            </div>
            <div className="mt-11 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8da99a]">
              {isAdmin ? 'Administrator' : 'Staff workspace'}
            </div>
            <nav className="mt-3 flex flex-col gap-1" aria-label="Main navigation">
              {visibleNav.map(({ label, icon: Icon }) => (
                  <button
                      key={label}
                      onClick={() => { setActiveNav(label); setSidebarOpen(false) }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${activeNav === label ? 'bg-[#d8ed65] font-semibold text-[#173a2e]' : 'text-[#c1d2c7] hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon size={18} /><span>{label === 'Users' && !isAdmin ? 'My Profile' : label}</span>
                  </button>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-5">
              <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#c1d2c7] hover:bg-white/10">
                {dark ? <Sun size={18} /> : <Moon size={18} />}{dark ? 'Light mode' : 'Dark mode'}
              </button>
              <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#c1d2c7] hover:bg-white/10">
                <LogOut size={18} />Sign out
              </button>
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/10 p-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-[#f5ad62] text-sm font-bold text-[#173a2e]">{displayInitials}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{userName || 'User'}</p>
                  <p className="truncate text-xs text-[#9eb7a9]">{isAdmin ? 'System administrator' : 'Collection staff'}</p>
                </div>
              </div>
            </div>
          </aside>
          {sidebarOpen && <button aria-label="Close navigation overlay" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

          <div className="lg:pl-[272px]">
            <header className="flex h-[76px] items-center justify-between border-b bg-card px-5 sm:px-8">
              <div className="flex items-center gap-3">
                <button className="rounded-lg p-2 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu /></button>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{today}</p>
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {greeting}, {firstName} <span className="text-[#e1a65c]">.</span>
                  </h1>
                </div>
              </div>

              <div className="relative flex items-center gap-3">
                {(bellOpen || profileOpen) && (
                    <button
                        aria-label="Close menu"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => { setBellOpen(false); setProfileOpen(false) }}
                    />
                )}

                {/* Search */}
                <button
                    onClick={() => { setSearchQuery(''); setSearchOpen(true) }}
                    className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                    aria-label="Search"
                >
                  <Search size={16} />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className="ml-2 hidden rounded border px-1.5 text-[10px] sm:inline">Ctrl K</kbd>
                </button>

                {/* Notifications */}
                <div className="relative z-40">
                  <button
                      onClick={() => { setBellOpen((o) => !o); setProfileOpen(false); setUnread(0) }}
                      className="relative rounded-xl border bg-background p-2.5 text-muted-foreground hover:bg-muted"
                      aria-label="Notifications"
                  >
                    <Bell size={18} />
                    {(unread > 0 || notifCounts.failed > 0) && (
                        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
                    )}
                  </button>
                  {bellOpen && (
                      <div className="absolute right-0 mt-2 w-80 rounded-2xl border bg-card p-2 shadow-2xl">
                        <div className="flex items-center justify-between px-3 py-2">
                          <p className="text-sm font-semibold">Recent activity</p>
                          {activity.length > 0 && (
                              <button className="text-xs text-muted-foreground hover:underline" onClick={() => setActivity([])}>Clear</button>
                          )}
                        </div>

                        {isAdmin && (notifCounts.failed > 0 || notifCounts.pending > 0) && (
                            <div className="mx-2 mb-2 flex flex-col gap-1 rounded-xl bg-muted/60 p-3 text-sm">
                              {notifCounts.failed > 0 && (
                                  <p className="flex items-center gap-2 text-red-700">
                                    <span className="size-2 rounded-full bg-destructive" />
                                    {notifCounts.failed} notification{notifCounts.failed > 1 ? 's' : ''} failed to send
                                  </p>
                              )}
                              {notifCounts.pending > 0 && (
                                  <p className="flex items-center gap-2 text-amber-700">
                                    <span className="size-2 rounded-full bg-[#f5ad62]" />
                                    {notifCounts.pending} pending
                                  </p>
                              )}
                            </div>
                        )}

                        <div className="max-h-72 overflow-y-auto">
                          {activity.length === 0 ? (
                              <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
                          ) : (
                              activity.map((a) => (
                                  <div key={a.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-muted">
                                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.type === 'error' ? 'bg-destructive' : 'bg-[#6b9d72]'}`} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm">{a.message}</p>
                                      <p className="text-xs text-muted-foreground">{a.time}</p>
                                    </div>
                                  </div>
                              ))
                          )}
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => { setActiveNav('Notifications'); setBellOpen(false) }}
                                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold hover:bg-muted"
                            >
                              View all notifications
                            </button>
                        )}
                      </div>
                  )}
                </div>

                {/* Profile */}
                <div className="relative z-40">
                  <button
                      onClick={() => { setProfileOpen((o) => !o); setBellOpen(false) }}
                      className="flex size-9 items-center justify-center rounded-full bg-[#d8ed65] text-xs font-bold text-[#173a2e]"
                      aria-label="Account menu"
                  >
                    {displayInitials}
                  </button>
                  {profileOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-2xl border bg-card p-2 shadow-2xl">
                        <div className="px-3 py-2.5">
                          <p className="truncate text-sm font-semibold">{userName || 'User'}</p>
                          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                          <span className="mt-2 inline-block rounded-full bg-[#d8ed65] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#173a2e]">
                            {isAdmin ? 'Administrator' : 'Staff'}
                          </span>
                        </div>
                        <div className="my-1 border-t" />
                        <button
                            onClick={() => { setActiveNav('Users'); setProfileOpen(false) }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted"
                        >
                          <UserCog size={16} />My profile
                        </button>
                        <button
                            onClick={() => { setProfileOpen(false); logout() }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted"
                        >
                          <LogOut size={16} />Sign out
                        </button>
                      </div>
                  )}
                </div>
              </div>
            </header>

            <main className="mx-auto max-w-[1500px] p-5 sm:p-8">
              {isAdmin && activeNav === 'Overview' && (
                  <div className="mb-7 flex justify-end">
                    <button onClick={() => setShowSchedule(true)} className="flex w-fit items-center gap-2 rounded-xl bg-[#173a2e] px-4 py-3 text-sm font-semibold text-white shadow-lg">
                      <Plus size={17} />Create schedule
                    </button>
                  </div>
              )}

              {activeNav === 'Overview' && (
                  <Overview
                      isAdmin={isAdmin}
                      onOpenRoutes={() => setActiveNav('Collection schedules')}
                  />
              )}

              {activeNav === 'Routes & zones' && <RoutesZones />}

              {activeNav === 'Trucks' && <Trucks isAdmin={isAdmin} />}

              {activeNav === 'Residents' && <RoutesResidents />}

              {activeNav === 'Notifications' && isAdmin && <RoutesNotifications />}

              {activeNav === 'Collection schedules' && <CollectionSchedulesView />}

              {activeNav === 'Users' && (
                  <RoutesUsers role={role} email={userEmail} onNameChange={setUserName} />
              )}

              {activeNav === 'Reports' && isAdmin && <Reports />}
            </main>
          </div>

          {showSchedule && (
              <ScheduleModal
                  routes={routes}
                  onClose={() => setShowSchedule(false)}
                  onPublish={() => { setShowSchedule(false); notify('Schedules published and residents notified') }}
              />
          )}

          {searchOpen && (
              <div
                  className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
                  onClick={() => setSearchOpen(false)}
              >
                <div
                    role="dialog"
                    aria-modal="true"
                    className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 border-b px-4">
                    <Search size={18} className="text-muted-foreground" />
                    <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && searchResults[0]) {
                            setActiveNav(searchResults[0].go)
                            setSearchOpen(false)
                          }
                        }}
                        placeholder="Search pages, zones, trucks…"
                        className="w-full bg-transparent py-4 text-sm outline-none"
                    />
                    <button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={18} /></button>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {searchResults.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for “{searchQuery}”</p>
                    ) : (
                        searchResults.map(({ key, label, hint, Icon, go }) => (
                            <button
                                key={key}
                                onClick={() => { setActiveNav(go); setSearchOpen(false) }}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-muted"
                            >
                              <Icon size={17} />
                              <span className="flex-1 text-left">{label}</span>
                              <span className="text-xs text-muted-foreground">{hint}</span>
                            </button>
                        ))
                    )}
                  </div>
                </div>
              </div>
          )}

          {toast && (
              <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-[#173a2e] px-4 py-3 text-sm font-medium text-white shadow-xl">
                {toast.type === 'error' ? <X size={17} className="text-red-300" /> : <Check size={17} className="text-[#d8ed65]" />}
                {toast.message}
              </div>
          )}
        </div>
      </div>
  )
}

function CollectionSchedulesView() {
  const [subTab, setSubTab] = useState<'schedules' | 'collections'>('schedules')

  return (
      <div>
        <div className="mb-5 inline-flex rounded-xl border bg-card p-1">
          <button
              onClick={() => setSubTab('schedules')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${subTab === 'schedules' ? 'bg-[#173a2e] text-white' : 'text-muted-foreground'}`}
          >
            Schedules
          </button>
          <button
              onClick={() => setSubTab('collections')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${subTab === 'collections' ? 'bg-[#173a2e] text-white' : 'text-muted-foreground'}`}
          >
            Collections
          </button>
        </div>

        {subTab === 'schedules' ? <Schedule /> : <Collections />}
      </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: (role: Role, email: string, name: string) => void }) {
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Shows the success banner after a reset redirects back to "/?reset=1"
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reset') === '1') {
      setNotice('Password updated. Please sign in with your new password.')
      window.history.replaceState({}, '', '/')
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${API_URL}/api/auth/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: email, password }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Incorrect username or password')
      }

      const data = await response.json()
      const backendRole = String(data.role).toLowerCase()
      if (backendRole !== 'admin' && backendRole !== 'staff') throw new Error('Invalid user role')

      onLogin(backendRole as Role, data.email || email, data.name || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#173a2e] p-5">
        <div className="absolute -left-24 -top-24 size-80 rounded-full bg-[#d8ed65]/15 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-20 size-96 rounded-full bg-[#f5ad62]/15 blur-3xl animate-pulse" />
        <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl bg-[#fbfcf9] shadow-2xl lg:grid-cols-[1fr_0.9fr]">
          <div className="hidden flex-col justify-between bg-[#d8ed65] p-10 text-[#173a2e] lg:flex">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#173a2e] text-[#d8ed65]"><Recycle /></div>
                <span className="text-xl font-semibold">Waste Track</span>
              </div>
              <h1 className="mt-20 max-w-sm text-5xl font-semibold leading-[1.05] tracking-tight">Cleaner routes. Stronger communities.</h1>
              <p className="mt-6 max-w-sm text-sm leading-6 text-[#3c5b40]">A single workspace for Eldoret administrators and collection teams.</p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">Waste Track Kenya · 2026</p>
          </div>

          {mode === 'login' ? (
              <form onSubmit={submit} className="p-7 sm:p-12">
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#173a2e] text-[#d8ed65] lg:hidden"><Recycle /></div>
                <p className="mt-8 text-sm font-medium text-[#789086]">Welcome back</p>
                <h2 className="mt-1 text-3xl font-semibold text-[#19332a]">Sign in to Waste Track</h2>
                <p className="mt-3 text-sm text-[#789086]">Enter your credentials to continue.</p>

                {notice && (
                    <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      <Check size={15} />{notice}
                    </div>
                )}
                {error && (
                    <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <X size={15} />{error}
                    </div>
                )}

                <label className="mt-8 block text-sm font-semibold text-[#19332a]">
                  Email address
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@wastetrack.ke" className="mt-2 w-full rounded-xl border border-[#dfe6dc] bg-white px-4 py-3 outline-none focus:border-[#6b9d72]" />
                </label>
                <label className="mt-4 block text-sm font-semibold text-[#19332a]">
                  Password
                  <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-2 w-full rounded-xl border border-[#dfe6dc] bg-white px-4 py-3 outline-none focus:border-[#6b9d72]" />
                </label>

                <div className="mt-2 flex justify-end">
                  <button
                      type="button"
                      onClick={() => { setError(''); setNotice(''); setMode('forgot') }}
                      style={{ color: '#245843' }}
                      className="text-xs font-semibold hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#173a2e] px-4 py-3.5 font-semibold text-white transition hover:bg-[#245843] disabled:opacity-70">
                  {loading ? 'Signing in…' : 'Sign in'}<LogIn size={17} />
                </button>
                <p className="mt-5 text-center text-xs text-[#9aaa9f]">Waste Track Kenya Inc</p>
              </form>
          ) : (
              <ForgotPasswordForm initialEmail={email} onBack={() => setMode('login')} />
          )}
        </div>
      </main>
  )
}

function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch (err) {
      console.error('Forgot password request failed:', err)
    } finally {
      setLoading(false)
      setSent(true) // same message whether or not the email exists
    }
  }

  return (
      <div className="p-7 sm:p-12">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[#173a2e] text-[#d8ed65] lg:hidden"><Recycle /></div>
        <p className="mt-8 text-sm font-medium text-[#789086]">Account recovery</p>
        <h2 className="mt-1 text-3xl font-semibold text-[#19332a]">Forgot your password?</h2>

        {sent ? (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <Check size={15} className="mt-0.5 shrink-0" />
              <span>reset link has been sent. It expires in 30 minutes.</span>
            </div>
        ) : (
            <form onSubmit={submit}>
              <p className="mt-3 text-sm text-[#789086]">Enter your email and we will send you a reset link.</p>
              <label className="mt-8 block text-sm font-semibold text-[#19332a]">
                Email address
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@wastetrack.ke" className="mt-2 w-full rounded-xl border border-[#dfe6dc] bg-white px-4 py-3 outline-none focus:border-[#6b9d72]" />
              </label>
              <button disabled={loading} className="mt-6 w-full rounded-xl bg-[#173a2e] px-4 py-3.5 font-semibold text-white transition hover:bg-[#245843] disabled:opacity-70">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
        )}

        <button
            type="button"
            onClick={onBack}
            style={{
              color: '#245843',
              borderColor: '#dfe6dc',
              backgroundColor: '#ffffff',
              opacity: 1,
            }}
            className="mt-6 flex w-full items-center justify-center gap-2
    rounded-xl border px-4 py-3 text-sm font-semibold
    transition hover:bg-[#f1f5ee]"
        >
          <ArrowLeft size={16} color="#245843" />
          <span style={{ color: '#245843', opacity: 1 }}>
    Back to sign in
  </span>
        </button>
      </div>
  )
}


function ScheduleModal({ routes, onClose, onPublish }: { routes: RouteRecord[]; onClose: () => void; onPublish: () => void }) {
  const [routeId, setRouteId] = useState('')
  const [date, setDate] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onPublish()
  }

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <form onSubmit={submit} role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Create collection schedule</h2>
              <p className="mt-1 text-sm text-muted-foreground">Publish a route and notify residents.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close dialog"><X /></button>
          </div>
          <div className="mt-5 flex flex-col gap-4">
            <label className="text-sm font-medium">
              Collection route
              <select value={routeId} onChange={(e) => setRouteId(e.target.value)} required={routes.length > 0} disabled={routes.length === 0} className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm disabled:opacity-60">
                {routes.length === 0
                    ? <option value="">No routes available</option>
                    : <>
                      <option value="">Select a route</option>
                      {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </>}
              </select>
              {routes.length === 0 && <span className="mt-1.5 block text-xs text-muted-foreground">Add routes to the database before creating a schedule.</span>}
            </label>
            <label className="text-sm font-medium">
              Collection date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm" />
            </label>
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border px-4 py-3 text-sm font-semibold">Cancel</button>
            <button type="submit" className="flex-1 rounded-xl bg-[#173a2e] px-4 py-3 text-sm font-semibold text-white">Publish schedule</button>
          </div>
        </form>
      </div>
  )
}