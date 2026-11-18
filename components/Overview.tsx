'use client'

import { useEffect, useState } from 'react'
import {
    CalendarDays, ChevronRight, Map as MapIcon, Users, PackageCheck, Truck as TruckIcon,
    Bell, Loader2, CheckCircle2, AlertTriangle, Clock, Send,
} from 'lucide-react'

// const API_URL = 'http://localhost:9123'
// const API_URL = 'https://notification-system-tman.onrender.com'
const API_URL = 'https://notificationsystem-production-bf454768.up.railway.app'

type Zone = { id: number; name: string }
type TruckRecord = {
    id: number
    plateNumber: string
    model?: string
    driverName?: string
    status: 'AVAILABLE' | 'IN_SERVICE' | 'MAINTENANCE'
}
type Schedule = {
    id: number
    zone: { id: number }
    truck?: TruckRecord | null
    collectionDate: string
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}
type Resident = { id: number }
type Collection = {
    id: number
    scheduleId: number
    residentId: number
    status: 'PENDING' | 'COLLECTED' | 'MISSED'
    collectedAt: string | null
}
type NotificationRecord = {
    id: number
    status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED' | 'READ'
}

async function fetchJSON<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, { credentials: 'include' })
    if (!res.ok) throw new Error(`Failed to fetch ${path}`)
    return res.json()
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Local date as YYYY-MM-DD (toISOString uses UTC, which is wrong near midnight in Kenya)
function localIsoDate(d = new Date()) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Counts up from 0 to the target number
function useCountUp(target: number, duration = 900) {
    const [value, setValue] = useState(0)
    useEffect(() => {
        let raf = 0
        const start = performance.now()
        const tick = (now: number) => {
            const p = Math.min(1, (now - start) / duration)
            setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
            if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [target, duration])
    return value
}

const ANIMATIONS = `
@keyframes ov-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes ov-grow    { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes ov-bar     { from { width: 0; } }
@keyframes ov-pulse   { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(1.5); } }
.ov-in   { animation: ov-fade-up .6s cubic-bezier(.2,.7,.2,1) backwards; }
.ov-lift { transition: transform .25s ease, box-shadow .25s ease; }
.ov-lift:hover { transform: translateY(-4px); box-shadow: 0 14px 30px -12px rgba(23,58,46,.35); }
.ov-bar-grow { transform-origin: bottom; animation: ov-grow .8s cubic-bezier(.2,.7,.2,1) backwards; }
.ov-bar-fill { animation: ov-bar 1s cubic-bezier(.2,.7,.2,1) backwards; }
.ov-dot { animation: ov-pulse 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ov-in, .ov-bar-grow, .ov-bar-fill, .ov-dot { animation: none !important; }
  .ov-lift { transition: none; }
}
`

export default function Overview({
                                     isAdmin,
                                     onOpenRoutes,
                                 }: {
    isAdmin: boolean
    onOpenRoutes: () => void
}) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [zones, setZones] = useState<Zone[]>([])
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [residents, setResidents] = useState<Resident[]>([])
    const [collections, setCollections] = useState<Collection[]>([])
    const [notifications, setNotifications] = useState<NotificationRecord[]>([])
    const [trucks, setTrucks] = useState<TruckRecord[]>([])

    useEffect(() => {
        void loadDashboard()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function loadDashboard() {
        setLoading(true)
        setError('')
        try {
            const [zonesData, schedulesData, residentsData, collectionsData] =
                await Promise.all([
                    fetchJSON<Zone[]>('/zones'),
                    fetchJSON<Schedule[]>('/schedules'),
                    fetchJSON<Resident[]>('/residents'),
                    fetchJSON<Collection[]>('/collections'),
                ])
            setZones(zonesData)
            setSchedules(schedulesData)
            setResidents(residentsData)
            setCollections(collectionsData)

            // Trucks are loaded separately so a trucks problem doesn't break the whole dashboard
            try {
                setTrucks(await fetchJSON<TruckRecord[]>('/trucks'))
            } catch (err) {
                console.error(err)
            }

            if (isAdmin) {
                setNotifications(await fetchJSON<NotificationRecord[]>('/notifications'))
            }
        } catch (err) {
            console.error(err)
            setError('Some dashboard data failed to load.')
        } finally {
            setLoading(false)
        }
    }

    const todayIso = localIsoDate()
    const schedulesToday = schedules.filter((s) => s.collectionDate === todayIso && s.status !== 'CANCELLED')
    const completedToday = schedulesToday.filter((s) => s.status === 'COMPLETED').length

    // Which truck is on duty today, keyed by truck id
    const todayByTruck = new Map<number, Schedule>()
    schedulesToday.forEach((s) => {
        if (s.truck) todayByTruck.set(s.truck.id, s)
    })
    const trucksOnDuty = todayByTruck.size

    const collectedCount = collections.filter((c) => c.status === 'COLLECTED').length
    const missedCount = collections.filter((c) => c.status === 'MISSED').length
    const pendingCount = collections.filter((c) => c.status === 'PENDING').length

    const sentCount = notifications.filter((n) => n.status === 'SENT').length
    const deliveredCount = notifications.filter((n) => n.status === 'DELIVERED' || n.status === 'READ').length
    const failedCount = notifications.filter((n) => n.status === 'FAILED').length
    const pendingNotifCount = notifications.filter((n) => n.status === 'PENDING').length
    const totalNotifSent = sentCount + deliveredCount

    const weeklyCounts = WEEKDAYS.map((_, idx) =>
        collections.filter((c) => {
            if (!c.collectedAt || c.status !== 'COLLECTED') return false
            return new Date(c.collectedAt).getDay() === idx
        }).length
    )
    const maxWeekly = Math.max(1, ...weeklyCounts)

    const upcomingSchedules = [...schedules]
        .sort((a, b) => a.collectionDate.localeCompare(b.collectionDate))
        .filter((s) => s.collectionDate >= todayIso && s.status !== 'CANCELLED')
        .slice(0, 6)

    const zoneName = (id?: number) =>
        zones.find((z) => z.id === id)?.name || `Zone #${id}`

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading dashboard...
            </div>
        )
    }

    return (
        <>
            <style>{ANIMATIONS}</style>

            {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Summary banner */}
            <section className="ov-in relative mb-6 overflow-hidden rounded-3xl bg-[#173a2e] p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#d8ed65]/15 blur-2xl" />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#f5ad62]/15 blur-2xl" />
                <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b6cbbd]">
                            <span className="ov-dot size-2 rounded-full bg-[#d8ed65]" />
                            Today&apos;s operations
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                            {schedulesToday.length === 0
                                ? 'No collections scheduled today'
                                : `${schedulesToday.length} collection${schedulesToday.length > 1 ? 's' : ''} today · ${trucksOnDuty} truck${trucksOnDuty === 1 ? '' : 's'} on duty`}
                        </h2>
                        <p className="mt-1 text-sm text-[#c1d2c7]">
                            {schedulesToday.length > 0
                                ? `${completedToday} of ${schedulesToday.length} completed so far`
                                : 'Create a schedule to assign a truck and notify residents.'}
                        </p>
                    </div>
                    <button
                        onClick={onOpenRoutes}
                        className="flex w-fit items-center gap-2 rounded-xl bg-[#d8ed65] px-4 py-3 text-sm font-semibold text-[#173a2e] transition hover:brightness-95"
                    >
                        View schedules <ChevronRight size={16} />
                    </button>
                </div>
            </section>

            {/* Stat cards */}
            <section className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${isAdmin ? '2xl:grid-cols-6' : '2xl:grid-cols-5'}`}>
                <Stat tone="light" icon={MapIcon} label="Zones" value={zones.length} detail="Active collection zones" delay={0} />
                <Stat tone="dark" icon={CalendarDays} label="Collections today" value={schedulesToday.length}
                      detail={schedulesToday.length ? `${completedToday} completed so far` : 'None scheduled today'} delay={70} />
                <Stat tone="light" icon={TruckIcon} label="Trucks on duty" value={trucksOnDuty}
                      detail={`${trucks.length} in fleet`} delay={140} />
                <Stat tone="light" icon={Users} label="Residents" value={residents.length} detail="Registered across all zones" delay={210} />
                <Stat tone="lime" icon={PackageCheck} label="Waste collected" value={collectedCount}
                      detail={`${missedCount} missed · ${pendingCount} pending`} delay={280} />
                {isAdmin && (
                    <Stat tone="orange" icon={Bell} label="Notifications sent" value={totalNotifSent}
                          detail={`${failedCount} failed · ${pendingNotifCount} pending`} delay={350} />
                )}
            </section>

            {/* Upcoming + trucks */}
            <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="ov-in rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="font-semibold">Upcoming collections</h3>
                            <p className="mt-1 text-xs text-muted-foreground">Next dates, with the assigned truck</p>
                        </div>
                        <button onClick={onOpenRoutes} className="text-xs font-semibold text-[#39705a]">
                            View list <ChevronRight className="inline size-4" />
                        </button>
                    </div>
                    <div className="mt-5 flex flex-col gap-3">
                        {upcomingSchedules.length === 0 ? (
                            <EmptyState icon={MapIcon} title="No upcoming schedules" subtitle="New schedules will appear here once created." />
                        ) : (
                            upcomingSchedules.map((s, i) => (
                                <ScheduleRow key={s.id} schedule={s} zoneName={zoneName(s.zone?.id)} delay={260 + i * 60} />
                            ))
                        )}
                    </div>
                </div>

                <div className="ov-in rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '260ms' }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="font-semibold">Truck fleet</h3>
                            <p className="mt-1 text-xs text-muted-foreground">Who is collecting today</p>
                        </div>
                        <span className="rounded-full bg-[#e3f1de] px-2.5 py-1 text-[10px] font-semibold text-[#173a2e]">
                            {trucksOnDuty} on duty
                        </span>
                    </div>
                    <div className="mt-5 flex flex-col gap-3">
                        {trucks.length === 0 ? (
                            <EmptyState icon={TruckIcon} title="No trucks yet" subtitle="Trucks added to the database will show up here." />
                        ) : (
                            trucks.map((t, i) => (
                                <TruckRow
                                    key={t.id}
                                    truck={t}
                                    todaySchedule={todayByTruck.get(t.id)}
                                    zoneName={zoneName}
                                    delay={320 + i * 60}
                                />
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* Weekly chart */}
            <section className="ov-in mt-6 rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '320ms' }}>
                <h3 className="font-semibold">Weekly collections</h3>
                <p className="mt-1 text-xs text-muted-foreground">Completed pickups by day of week</p>
                {collections.length === 0 ? (
                    <div className="mt-7 flex h-44 items-center justify-center rounded-xl bg-muted/40">
                        <EmptyState icon={PackageCheck} title="No data yet" subtitle="Weekly stats will show up once collections are logged." compact />
                    </div>
                ) : (
                    <div className="mt-7 flex h-44 items-end justify-between gap-3">
                        {WEEKDAYS.map((day, idx) => {
                            const count = weeklyCounts[idx]
                            const height = count > 0 ? Math.max(8, Math.round((count / maxWeekly) * 140)) : 3
                            const isToday = new Date().getDay() === idx
                            return (
                                <div key={day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                                    <span className="text-[10px] font-semibold text-muted-foreground">{count > 0 ? count : ''}</span>
                                    <div
                                        className={`ov-bar-grow w-full rounded-t-lg ${isToday ? 'bg-[#173a2e]' : 'bg-[#4c8c62]/60'}`}
                                        style={{ height, animationDelay: `${idx * 70}ms` }}
                                    />
                                    <span className={`text-[10px] ${isToday ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{day}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Notification delivery (admin only) */}
            {isAdmin && (
                <section className="ov-in mt-6 rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '380ms' }}>
                    <h3 className="font-semibold">Notification delivery</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Status of resident notifications sent by the system</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DeliveryRow icon={Send} label="Sent" count={sentCount} total={notifications.length} colorClass="text-[#39705a] bg-[#e3f1de]" bar="bg-[#4c8c62]" />
                        <DeliveryRow icon={CheckCircle2} label="Delivered" count={deliveredCount} total={notifications.length} colorClass="text-[#173a2e] bg-[#d8ed65]" bar="bg-[#173a2e]" />
                        <DeliveryRow icon={Clock} label="Pending" count={pendingNotifCount} total={notifications.length} colorClass="text-amber-700 bg-amber-100" bar="bg-[#f5ad62]" />
                        <DeliveryRow icon={AlertTriangle} label="Failed" count={failedCount} total={notifications.length} colorClass="text-red-700 bg-red-100" bar="bg-red-500" />
                    </div>
                </section>
            )}
        </>
    )
}

const TONES = {
    light:  { card: 'bg-card border', icon: 'bg-[#e3f1de] text-[#4c8c62]', label: 'text-muted-foreground', sub: 'text-muted-foreground' },
    dark:   { card: 'bg-[#173a2e] text-white', icon: 'bg-[#d8ed65] text-[#173a2e]', label: 'text-[#b6cbbd]', sub: 'text-[#9eb7a9]' },
    lime:   { card: 'bg-[#d8ed65] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#d8ed65]', label: 'text-[#3c5b40]', sub: 'text-[#3c5b40]' },
    orange: { card: 'bg-[#f5ad62] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#f5ad62]', label: 'text-[#5a3a14]', sub: 'text-[#5a3a14]' },
} as const

function Stat({ icon: Icon, label, value, detail, tone, delay }: {
    icon: typeof CalendarDays; label: string; value: number; detail: string
    tone: keyof typeof TONES; delay: number
}) {
    const t = TONES[tone]
    const shown = useCountUp(value)
    return (
        <div className={`ov-in ov-lift rounded-2xl p-5 shadow-sm ${t.card}`} style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${t.icon}`}><Icon size={19} /></div>
            <p className={`mt-5 text-sm ${t.label}`}>{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{shown}</p>
            <p className={`mt-1 text-xs ${t.sub}`}>{detail}</p>
        </div>
    )
}

function EmptyState({ icon: Icon, title, subtitle, compact }: { icon: typeof MapIcon; title: string; subtitle: string; compact?: boolean }) {
    return (
        <div className={compact ? 'text-center' : 'w-full rounded-xl bg-muted/60 p-8 text-center'}>
            <Icon className="mx-auto text-muted-foreground" size={compact ? 22 : 26} />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
    )
}

function ScheduleRow({ schedule, zoneName, delay }: { schedule: Schedule; zoneName: string; delay: number }) {
    const cls =
        schedule.status === 'COMPLETED' ? 'bg-[#e3f1de] text-[#4c8c62]'
            : schedule.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'

    return (
        <div className="ov-in ov-lift flex items-center gap-3 rounded-xl bg-muted/60 p-3" style={{ animationDelay: `${delay}ms` }}>
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#173a2e] text-[#d8ed65]"><MapIcon size={16} /></div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{zoneName}</p>
                <p className="text-xs text-muted-foreground">
                    {schedule.collectionDate}
                    {schedule.truck ? ` · ${schedule.truck.plateNumber}` : ' · No truck'}
                </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${cls}`}>
                {schedule.status.replace('_', ' ').toLowerCase()}
            </span>
        </div>
    )
}

function TruckRow({ truck, todaySchedule, zoneName, delay }: {
    truck: TruckRecord; todaySchedule?: Schedule; zoneName: (id?: number) => string; delay: number
}) {
    const maintenance = truck.status === 'MAINTENANCE'
    const onDuty = !!todaySchedule
    const pill = maintenance
        ? 'bg-red-100 text-red-700'
        : onDuty
            ? 'bg-[#d8ed65] text-[#173a2e]'
            : 'bg-[#e3f1de] text-[#4c8c62]'
    const text = maintenance
        ? 'Maintenance'
        : onDuty
            ? `On duty · ${zoneName(todaySchedule!.zone?.id)}`
            : 'Available'

    return (
        <div className="ov-in ov-lift flex items-center gap-3 rounded-xl bg-muted/60 p-3" style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-9 items-center justify-center rounded-lg ${maintenance ? 'bg-red-100 text-red-600' : 'bg-[#173a2e] text-[#d8ed65]'}`}>
                <TruckIcon size={16} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-wide">{truck.plateNumber}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {truck.driverName || 'No driver'}{truck.model ? ` · ${truck.model}` : ''}
                </p>
            </div>
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${pill}`}>
                {onDuty && !maintenance && <span className="ov-dot size-1.5 rounded-full bg-[#173a2e]" />}
                {text}
            </span>
        </div>
    )
}

function DeliveryRow({ icon: Icon, label, count, total, colorClass, bar }: {
    icon: typeof CheckCircle2; label: string; count: number; total: number; colorClass: string; bar: string
}) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    const shown = useCountUp(count)
    return (
        <div className="ov-lift rounded-xl bg-muted/40 p-4">
            <div className="flex items-center gap-2">
                <div className={`flex size-8 items-center justify-center rounded-lg ${colorClass}`}><Icon size={16} /></div>
                <span className="text-sm font-medium">{label}</span>
            </div>
            <p className="mt-3 text-xl font-semibold tabular-nums">{shown}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={`ov-bar-fill h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{pct}% of {total}</p>
        </div>
    )
}