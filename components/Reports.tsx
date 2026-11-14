'use client'

import { useEffect, useState } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
    FileText, CalendarDays, Loader2, AlertCircle, Download, RefreshCw,
    CheckCircle2, Send, PackageCheck, MapPinned, Truck as TruckIcon, Map as MapIcon,
} from 'lucide-react'

// const API_URL = 'http://localhost:9123'
const API_URL = 'https://notification-system-tman.onrender.com'


// One item of "Top failure reasons". `code` is the clean error code saved by the
// backend ("UNKNOWN" for old rows). `detail` is a sample of the raw provider text
// and can be null.
type FailureItem = { code?: string | null; detail: string | null; count: number }

type Summary = {
    range: { from: string; to: string }
    schedules: {
        total: number
        byStatus: Record<string, number>
        completionRate: number | null
        byMonth: { month: string; total: number; completed: number }[]
    }
    notifications: {
        total: number
        wentOut: number
        pending: number
        failed: number
        failureRate: number | null
        byStatus: Record<string, number>
        byChannel: Record<string, number>
        topFailures: FailureItem[]
    }
    collections: {
        total: number
        collected: number
        missed: number
        pending: number
        collectionRate: number | null
    }
    coverage: { zones: number; zonesWithoutDay: number; residents: number }
}

type ZoneRow = {
    id: number
    name: string
    collectionDay: string | null
    residents: number
    schedules: number
    completed: number
    completionRate: number | null
    collected: number
    missed: number
}

type TruckRow = {
    id: number
    plateNumber: string
    driverName: string | null
    status: 'AVAILABLE' | 'IN_SERVICE' | 'MAINTENANCE'
    schedules: number
    completed: number
    completionRate: number | null
}

type TrucksReport = {
    range: { from: string; to: string }
    trucks: TruckRow[]
    unassignedSchedules: number
}

type Preset = '7' | '30' | 'month' | 'custom'

/* ------------------------------------------------------------------
   Look and feel (same palette tokens as the other tabs)
   ------------------------------------------------------------------ */
const TONES = {
    light:  { card: 'bg-card border', icon: 'bg-[#e3f1de] text-[#4c8c62]', label: 'text-muted-foreground' },
    dark:   { card: 'bg-[#173a2e] text-white', icon: 'bg-[#d8ed65] text-[#173a2e]', label: 'text-[#b6cbbd]' },
    lime:   { card: 'bg-[#d8ed65] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#d8ed65]', label: 'text-[#3c5b40]' },
    orange: { card: 'bg-[#f5ad62] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#f5ad62]', label: 'text-[#5a3a14]' },
} as const

// Chart colours are picked to stay readable on both the light and dark theme
const SCHEDULE_STATUS = {
    SCHEDULED:   { label: 'Scheduled',   color: '#f5ad62' },
    IN_PROGRESS: { label: 'In progress', color: '#5b9bd5' },
    COMPLETED:   { label: 'Completed',   color: '#4c8c62' },
    CANCELLED:   { label: 'Cancelled',   color: '#d9534f' },
} as const

const MESSAGE_STATUS = {
    PENDING:   { label: 'Pending',   color: '#f5ad62' },
    SENT:      { label: 'Sent',      color: '#5b9bd5' },
    DELIVERED: { label: 'Delivered', color: '#4c8c62' },
    READ:      { label: 'Read',      color: '#9ac23c' },
    FAILED:    { label: 'Failed',    color: '#d9534f' },
} as const

const CHANNEL_LABEL: Record<string, string> = { SMS: 'SMS', WHATSAPP: 'WhatsApp' }

const TRUCK_PILL: Record<TruckRow['status'], { label: string; cls: string }> = {
    AVAILABLE:   { label: 'Available',   cls: 'bg-[#e3f1de] text-[#4c8c62]' },
    IN_SERVICE:  { label: 'In service',  cls: 'bg-blue-100 text-blue-700' },
    MAINTENANCE: { label: 'Maintenance', cls: 'bg-amber-100 text-amber-700' },
}

const ANIMATIONS = `
@keyframes rp-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.rp-in   { animation: rp-fade-up .5s cubic-bezier(.2,.7,.2,1) backwards; }
.rp-lift { transition: transform .25s ease, box-shadow .25s ease; }
.rp-lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(23,58,46,.35); }
.rp-grid  { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); }
.rp-panel { min-width: 0; }
@media (min-width: 1024px) {
  .rp-grid { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .rp-in { animation: none !important; }
  .rp-lift { transition: none; }
}
`

/* ------------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------------ */
const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function parseISO(iso: string) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
}

function addDays(d: Date, n: number) {
    const copy = new Date(d)
    copy.setDate(copy.getDate() + n)
    return copy
}

function rangeFor(preset: Exclude<Preset, 'custom'>) {
    const today = new Date()
    if (preset === '7') return { from: toISO(addDays(today, -6)), to: toISO(today) }
    if (preset === '30') return { from: toISO(addDays(today, -29)), to: toISO(today) }
    return { from: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), to: toISO(today) }
}

function formatDay(iso: string) {
    return parseISO(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function monthLabel(key: string) {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-KE', { month: 'short', year: '2-digit' })
}

function dayName(value: string | null) {
    if (!value) return 'No day set'
    return value.charAt(0) + value.slice(1).toLowerCase()
}

// 0.6667 -> "66.7%", null -> a dash
function pct(rate: number | null | undefined) {
    if (rate === null || rate === undefined) return '–'
    return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`
}

class HttpError extends Error {
    status: number
    constructor(status: number) {
        super(`HTTP ${status}`)
        this.status = status
    }
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, { credentials: 'include', signal })
    if (!res.ok) throw new HttpError(res.status)
    return res.json()
}

function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
    const esc = (v: string | number | null) => {
        let s = v === null ? '' : String(v)
        // Stop spreadsheet apps from running text that starts like a formula
        if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------
   Page
   ------------------------------------------------------------------ */
export default function Reports() {
    const initial = rangeFor('30')
    const [preset, setPreset] = useState<Preset>('30')
    const [from, setFrom] = useState(initial.from)
    const [to, setTo] = useState(initial.to)
    const [reloadKey, setReloadKey] = useState(0)

    const [summary, setSummary] = useState<Summary | null>(null)
    const [zones, setZones] = useState<ZoneRow[]>([])
    const [trucks, setTrucks] = useState<TrucksReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const days = Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000)
    const rangeError =
        !from || !to ? 'Choose both a start and an end date.'
            : from > to ? 'The start date must be on or before the end date.'
                : days > 366 ? 'The range can be at most one year.'
                    : ''

    useEffect(() => {
        if (rangeError) return
        const controller = new AbortController()

        async function load() {
            setLoading(true)
            setError('')
            try {
                const qs = `from=${from}&to=${to}`
                const [s, z, t] = await Promise.all([
                    getJson<Summary>(`/reports/summary?${qs}`, controller.signal),
                    getJson<ZoneRow[]>(`/reports/zones?${qs}`, controller.signal),
                    getJson<TrucksReport>(`/reports/trucks?${qs}`, controller.signal),
                ])
                setSummary(s)
                setZones(z)
                setTrucks(t)
                setLoading(false)
            } catch (err) {
                if ((err as Error).name === 'AbortError') return // a newer request replaced this one
                console.error(err)
                setError(
                    err instanceof HttpError
                        ? `The server answered ${err.status} for the reports request.${
                            err.status === 403 ? ' Reports are for administrators only.' : ''
                        }`
                        : 'Could not load the reports. Check your connection and try again.'
                )
                setLoading(false)
            }
        }

        load()
        return () => controller.abort()
    }, [from, to, rangeError, reloadKey])

    function choosePreset(p: Exclude<Preset, 'custom'>) {
        const r = rangeFor(p)
        setPreset(p)
        setFrom(r.from)
        setTo(r.to)
    }

    const presets: { key: Preset; label: string }[] = [
        { key: '7', label: 'Last 7 days' },
        { key: '30', label: 'Last 30 days' },
        { key: 'month', label: 'This month' },
        { key: 'custom', label: 'Custom' },
    ]

    const dateCls =
        'rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-[#6b9d72]'

    const s = summary
    const completed = s?.schedules.byStatus.COMPLETED ?? 0
    const cancelled = s?.schedules.byStatus.CANCELLED ?? 0
    const nothingHappened = !!s && s.schedules.total === 0 && s.notifications.total === 0 && s.collections.total === 0

    return (
        <>
            <style>{ANIMATIONS}</style>

            {/* Header banner */}
            <section className="rp-in relative mb-6 overflow-hidden rounded-3xl bg-[#173a2e] p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#d8ed65]/15 blur-2xl" />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#f5ad62]/15 blur-2xl" />
                <div className="relative flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d8ed65] text-[#173a2e]">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reports</h2>
                        <p className="mt-1 text-sm text-[#c1d2c7]">
                            {rangeError ? 'Pick a valid date range' : `${formatDay(from)} – ${formatDay(to)}`}
                        </p>
                    </div>
                </div>
            </section>

            {/* Date range */}
            <section className="rp-in mb-6 flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex flex-wrap rounded-xl border bg-background p-1">
                    {presets.map((p) => (
                        <button
                            key={p.key}
                            aria-pressed={preset === p.key}
                            onClick={() => (p.key === 'custom' ? setPreset('custom') : choosePreset(p.key))}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                preset === p.key ? 'bg-[#173a2e] text-white' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <CalendarDays size={14} className="text-[#4c8c62]" />
                        From
                        <input
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(e) => { setPreset('custom'); setFrom(e.target.value) }}
                            className={dateCls}
                        />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        To
                        <input
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(e) => { setPreset('custom'); setTo(e.target.value) }}
                            className={dateCls}
                        />
                    </label>
                    <button
                        onClick={() => setReloadKey((k) => k + 1)}
                        disabled={loading || !!rangeError}
                        aria-label="Refresh reports"
                        className="rounded-xl border p-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </section>

            {rangeError && (
                <Notice tone="error">{rangeError}</Notice>
            )}
            {error && !rangeError && (
                <Notice tone="error">{error}</Notice>
            )}

            {loading && !s && !error && !rangeError && (
                <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card py-16 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading reports...
                </div>
            )}

            {s && (
                <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
                    {nothingHappened && (
                        <Notice tone="info">
                            No schedules, messages or pickups fall inside this range. Try a wider date range.
                        </Notice>
                    )}

                    {/* Stat cards */}
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Stat
                            tone="dark" icon={CheckCircle2} delay={0}
                            label="Completion rate"
                            value={pct(s.schedules.completionRate)}
                            detail={`${completed} of ${s.schedules.total - cancelled} pickups completed`}
                        />
                        <Stat
                            tone="orange" icon={Send} delay={70}
                            label="Messages sent"
                            value={s.notifications.wentOut}
                            detail={`${pct(s.notifications.failureRate)} failed · ${s.notifications.pending} pending`}
                        />
                        <Stat
                            tone="lime" icon={PackageCheck} delay={140}
                            label="Collection rate"
                            value={pct(s.collections.collectionRate)}
                            detail={`${s.collections.collected} collected · ${s.collections.missed} missed`}
                        />
                        <Stat
                            tone="light" icon={MapPinned} delay={210}
                            label="Residents covered"
                            value={s.coverage.residents}
                            detail={`${s.coverage.zones} zones · ${s.coverage.zonesWithoutDay} without a day`}
                        />
                    </section>

                    {/* Schedules charts */}
                    <section className="rp-grid mt-6">
                        <Panel title="Schedules by month" subtitle="Cancelled schedules are not counted" delay={120}>
                            <SchedulesByMonthChart data={s.schedules.byMonth} />
                        </Panel>
                        <Panel title="Schedule status" subtitle="Share of schedules in this range" delay={160}>
                            <ScheduleStatusDonut byStatus={s.schedules.byStatus} total={s.schedules.total} />
                        </Panel>
                    </section>

                    {/* Notification charts */}
                    <section className="rp-grid mt-4">
                        <Panel title="Message delivery" subtitle="Where each notification ended up" delay={200}>
                            <DeliveryChart byStatus={s.notifications.byStatus} total={s.notifications.total} />
                        </Panel>
                        <Panel title="Channels and failures" subtitle="SMS vs WhatsApp, and why messages fail" delay={240}>
                            <ChannelsAndFailures
                                byChannel={s.notifications.byChannel}
                                failures={s.notifications.topFailures}
                                total={s.notifications.total}
                            />
                        </Panel>
                    </section>

                    {/* Zones table */}
                    <Panel
                        className="mt-6"
                        title="Zones"
                        subtitle="Residents, completion and pickups per zone"
                        delay={280}
                        action={
                            <ExportButton
                                disabled={zones.length === 0}
                                onClick={() =>
                                    downloadCsv(
                                        `zones-report-${from}_to_${to}.csv`,
                                        ['Zone', 'Collection day', 'Residents', 'Schedules', 'Completed', 'Completion %', 'Collected', 'Missed'],
                                        zones.map((z) => [
                                            z.name, dayName(z.collectionDay), z.residents, z.schedules, z.completed,
                                            z.completionRate === null ? '' : Number((z.completionRate * 100).toFixed(1)),
                                            z.collected, z.missed,
                                        ])
                                    )
                                }
                            />
                        }
                    >
                        <ZonesTable zones={zones} />
                    </Panel>

                    {/* Trucks table */}
                    <Panel
                        className="mt-4"
                        title="Trucks"
                        subtitle="How much each truck worked in this range"
                        delay={320}
                        action={
                            <ExportButton
                                disabled={!trucks || trucks.trucks.length === 0}
                                onClick={() =>
                                    trucks &&
                                    downloadCsv(
                                        `trucks-report-${from}_to_${to}.csv`,
                                        ['Plate', 'Driver', 'Status', 'Schedules', 'Completed', 'Completion %'],
                                        trucks.trucks.map((t) => [
                                            t.plateNumber, t.driverName ?? '', TRUCK_PILL[t.status]?.label ?? t.status,
                                            t.schedules, t.completed,
                                            t.completionRate === null ? '' : Number((t.completionRate * 100).toFixed(1)),
                                        ])
                                    )
                                }
                            />
                        }
                    >
                        <TrucksTable report={trucks} />
                    </Panel>
                </div>
            )}
        </>
    )
}

/* ------------------------------------------------------------------
   Building blocks
   ------------------------------------------------------------------ */
function Notice({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
    const cls =
        tone === 'error'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
    return (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${cls}`}>
            <AlertCircle size={16} className="shrink-0" />
            {children}
        </div>
    )
}

function Stat({ icon: Icon, label, value, detail, tone, delay }: {
    icon: typeof FileText; label: string; value: number | string; detail: string
    tone: keyof typeof TONES; delay: number
}) {
    const t = TONES[tone]
    return (
        <div className={`rp-in rp-lift rounded-2xl p-5 shadow-sm ${t.card}`} style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${t.icon}`}><Icon size={19} /></div>
            <p className={`mt-5 text-sm ${t.label}`}>{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            <p className={`mt-1 text-xs ${t.label}`}>{detail}</p>
        </div>
    )
}

function Panel({ title, subtitle, action, className = '', delay = 0, children }: {
    title: string; subtitle?: string; action?: React.ReactNode
    className?: string; delay?: number; children: React.ReactNode
}) {
    return (
        <section className={`rp-in rp-panel rounded-2xl border bg-card p-5 shadow-sm ${className}`} style={{ animationDelay: `${delay}ms` }}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold">{title}</h3>
                    {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
                </div>
                {action}
            </div>
            <div className="mt-5">{children}</div>
        </section>
    )
}

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
        >
            <Download size={14} />
            CSV
        </button>
    )
}

function EmptyChart({ text = 'No data in this range' }: { text?: string }) {
    return (
        <div className="flex items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground" style={{ height: '100%', minHeight: 160 }}>
            {text}
        </div>
    )
}

// Custom tooltip so it follows the app theme (a recharts default tooltip is always white)
type TipItem = { name?: string | number; value?: number | string; color?: string; payload?: { color?: string } }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: readonly TipItem[]; label?: string | number }) {
    if (!active || !payload || payload.length === 0) return null
    return (
        <div className="rounded-xl border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
            {label !== undefined && label !== '' && <p className="mb-1 font-semibold">{label}</p>}
            {payload.map((p, i) => (
                <p key={i} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.color }} />
                    <span className="text-muted-foreground">{p.name}</span>
                    <span className="ml-auto font-semibold tabular-nums">{p.value}</span>
                </p>
            ))}
        </div>
    )
}

const axisTick = { fontSize: 12, fill: 'currentColor' }

/* ------------------------------------------------------------------
   Failure reasons: turn error codes into plain messages
   ------------------------------------------------------------------ */
type FailureInfo = {
    title: string
    hint: string
    tone: 'fix' | 'retry' | 'system'
}

// Exact codes saved by the backend (error_code column). This is checked first.
const FAILURE_BY_CODE: Record<string, FailureInfo> = {
    // Africa's Talking (SMS)
    InvalidPhoneNumber:   { title: 'Invalid phone number', hint: 'Check the resident’s number and use the format +2547XXXXXXXX.', tone: 'fix' },
    UnsupportedNumberType:{ title: 'Number type not supported', hint: 'This number cannot receive SMS. Ask the resident for another number.', tone: 'fix' },
    UserInBlacklist:      { title: 'Resident opted out', hint: 'This resident blocked messages. Contact them another way.', tone: 'fix' },
    InsufficientBalance:  { title: 'Out of SMS credit', hint: 'Top up your Africa’s Talking account.', tone: 'system' },
    InvalidSenderId:      { title: 'Sender ID not allowed', hint: 'Check the sender ID configured in Africa’s Talking.', tone: 'system' },
    RiskHold:             { title: 'Held for review', hint: 'Africa’s Talking is reviewing this message. Contact their support.', tone: 'system' },
    DoNotDisturbRejection:{ title: 'Resident on Do Not Disturb', hint: 'The network blocked marketing-type messages to this number.', tone: 'fix' },
    CouldNotRoute:        { title: 'Network could not route SMS', hint: 'The carrier could not deliver. Try again later.', tone: 'retry' },
    GatewayError:         { title: 'SMS gateway error', hint: 'Temporary problem at the provider. Retry later.', tone: 'retry' },
    InternalServerError:  { title: 'SMS gateway error', hint: 'Temporary problem at the provider. Retry later.', tone: 'retry' },
    RejectedByGateway:    { title: 'Rejected by the carrier', hint: 'The network filtered the message. Check the content.', tone: 'system' },
    NO_RECIPIENT:         { title: 'SMS not accepted', hint: 'The provider accepted no recipient. Check the number and sender ID.', tone: 'fix' },
    HTTP_401:             { title: 'Provider login rejected', hint: 'The API key is wrong or expired. Update it in the server settings.', tone: 'system' },
    DeliveryFailure:      { title: 'Phone could not be reached', hint: 'The network could not deliver to this phone. Check the number, then retry.', tone: 'retry' },
    UserInBlackList:      { title: 'Resident opted out', hint: 'This resident blocked messages. Contact them another way.', tone: 'fix' },
    InsufficientCredit:   { title: 'Out of SMS credit', hint: 'Top up your Africa’s Talking account.', tone: 'system' },
    NotNetworkSubscriber: { title: 'Number not active on the network', hint: 'Check the number with the resident.', tone: 'fix' },
    UserDoesNotExist:     { title: 'Number does not exist', hint: 'Check the number with the resident.', tone: 'fix' },


    // Meta WhatsApp Cloud API
    '131030': { title: 'Number not allowed to receive messages', hint: 'Your WhatsApp app is in test mode. Add this number to the allowed recipients or go live.', tone: 'system' },
    '131026': { title: 'Number is not on WhatsApp', hint: 'Send this resident an SMS instead.', tone: 'fix' },
    '133010': { title: 'WhatsApp number not registered', hint: 'The sending number is not registered. Check the phone number ID.', tone: 'system' },
    '131047': { title: '24-hour window closed', hint: 'Free-text messages only work within 24h of the resident’s last reply. Use the template mode.', tone: 'system' },
    '132000': { title: 'Template parameters do not match', hint: 'The number of values sent differs from the template.', tone: 'system' },
    '132001': { title: 'Template not found', hint: 'Check the template name and language (collection_reminder / en).', tone: 'system' },
    '132005': { title: 'Template text too long', hint: 'The filled-in template is too long after translation.', tone: 'system' },
    '132007': { title: 'Template blocked by policy', hint: 'Meta rejected the template content. Review it in Meta Business Manager.', tone: 'system' },
    '131049': { title: 'Meta limited this message', hint: 'Meta limits messages to some users to keep quality high. Retry later or use SMS.', tone: 'retry' },
    '131048': { title: 'Flagged as spam', hint: 'Too many messages were reported. Slow down and review your content.', tone: 'system' },
    '131056': { title: 'Too many messages to one number', hint: 'Wait a little before sending again.', tone: 'retry' },
    '130429': { title: 'Sending too fast', hint: 'WhatsApp throttled us. These messages can be retried.', tone: 'retry' },
    '131042': { title: 'WhatsApp billing problem', hint: 'Check the payment method on your Meta business account.', tone: 'system' },
    '131031': { title: 'WhatsApp account locked', hint: 'Check the account status in Meta Business Manager.', tone: 'system' },
    '190':    { title: 'WhatsApp access token expired', hint: 'Generate a new token and update whatsapp.access-token.', tone: 'system' },
    '100':    { title: 'WhatsApp rejected the request', hint: 'A parameter is invalid. Check the number format and template details.', tone: 'fix' },

    // Both
    NETWORK:  { title: 'Provider did not respond', hint: 'Temporary network problem. Retry later.', tone: 'retry' },
}
// Fallback for codes not in the map: match on the raw text. First match wins,
// so more specific rules must come before broader ones.
const FAILURE_RULES: { test: RegExp; info: FailureInfo }[] = [
    {
        test: /invalid.*(phone|number|recipient)|InvalidPhoneNumber|not a valid|\b21211\b|\b21614\b/i,
        info: { title: 'Invalid phone number', hint: 'Check the resident’s number and use the format +2547XXXXXXXX.', tone: 'fix' },
    },
    {
        test: /no phone|missing.*(phone|number)|phone.*(missing|empty)/i,
        info: { title: 'Resident has no phone number', hint: 'Add a phone number to the resident’s profile.', tone: 'fix' },
    },
    {
        test: /opt(ed)?[- ]?out|unsubscribe|blacklist|\b21610\b/i,
        info: { title: 'Resident opted out', hint: 'This resident blocked messages. Contact them another way.', tone: 'fix' },
    },
    {
        test: /not (registered )?on whatsapp|\b63003\b|\b63024\b/i,
        info: { title: 'Number is not on WhatsApp', hint: 'Send this resident an SMS instead.', tone: 'fix' },
    },
    {
        test: /template|\b63016\b|\b63007\b|\b63015\b|24[- ]?hour/i,
        info: { title: 'WhatsApp template problem', hint: 'The message template is not approved, or the 24-hour window has closed.', tone: 'system' },
    },
    {
        test: /insufficient|balance|credit|funds|\b402\b/i,
        info: { title: 'Out of messaging credit', hint: 'Top up your SMS/WhatsApp provider account.', tone: 'system' },
    },
    {
        test: /unauthori[sz]ed|authenticat|credential|api key|invalid token|access token|\b20003\b|\b401\b|\b403\b/i,
        info: { title: 'Provider login rejected', hint: 'The messaging API key or token is wrong or expired. Update it in the server settings.', tone: 'system' },
    },
    {
        test: /rate limit|too many|\b429\b|throttl/i,
        info: { title: 'Sending too fast', hint: 'The provider throttled us. These messages can be retried.', tone: 'retry' },
    },
    // Must come BEFORE the network rule: "NotNetworkSubscriber" contains the word "network"
    {
        test: /DeliveryFailure|AbsentSubscriber|NotNetworkSubscriber|UserNotSubscribed|absent|unreachable|switched off|out of coverage|\b30003\b|\b30005\b|handset/i,
        info: {
            title: 'Phone could not be reached',
            hint: 'The network could not deliver to this phone. It may be off, out of coverage, or the number is wrong. Check the number, then retry.',
            tone: 'retry',
        },
    },
    {
        test: /timeout|timed out|I\/O error|SSL|plaintext|ETIMEDOUT|ECONNRESET|ENOTFOUND|network|\b50[234]\b|unavailable/i,
        info: { title: 'Provider did not respond', hint: 'Temporary network problem. Retry later.', tone: 'retry' },
    },
    {
        test: /carrier|\b30007\b|\b30006\b|filtered|spam|RejectedByGateway/i,
        info: { title: 'Rejected by the carrier', hint: 'The mobile network filtered the message. Check the sender ID or content.', tone: 'system' },
    },
]

function explainFailure(
    code: string | null | undefined,
    detail: string | null
): FailureInfo {
    const hit = code && code !== 'UNKNOWN' ? FAILURE_BY_CODE[code] : undefined
    if (hit) return hit

    const fallback = detail
        ? FAILURE_RULES.find((r) => r.test.test(detail))
        : undefined

    return fallback?.info ?? {
        title: 'Message could not be delivered',
        hint: 'Unrecognised cause. Open the technical details.',
        tone: 'system',
    }
}


const FAILURE_TONE: Record<FailureInfo['tone'], { label: string; cls: string }> = {
    fix:    { label: 'Needs your action', cls: 'bg-red-100 text-red-700' },
    retry:  { label: 'Can retry',         cls: 'bg-blue-100 text-blue-700' },
    system: { label: 'System issue',      cls: 'bg-amber-100 text-amber-700' },
}


function SchedulesByMonthChart({ data }: { data: Summary['schedules']['byMonth'] }) {
    if (data.length === 0) return <div style={{ height: 288 }}><EmptyChart /></div>
    const rows = data.map((m) => ({ label: monthLabel(m.month), total: m.total, completed: m.completed }))
    return (
        <div className="w-full text-muted-foreground" style={{ height: 288 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-muted-foreground">{v}</span>} />
                    <Bar dataKey="total" name="All schedules" fill="#f5ad62" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="completed" name="Completed" fill="#4c8c62" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function ScheduleStatusDonut({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
    const rows = (Object.keys(SCHEDULE_STATUS) as (keyof typeof SCHEDULE_STATUS)[]).map((k) => ({
        key: k,
        name: SCHEDULE_STATUS[k].label,
        color: SCHEDULE_STATUS[k].color,
        value: byStatus[k] ?? 0,
    }))

    if (total === 0) return <div style={{ height: 288 }}><EmptyChart /></div>

    return (
        <div>
            <div className="relative w-full" style={{ height: 192 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Tooltip content={<ChartTooltip />} />
                        <Pie
                            data={rows.filter((r) => r.value > 0)}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="62%"
                            outerRadius="92%"
                            paddingAngle={2}
                            stroke="none"
                        >
                            {rows.filter((r) => r.value > 0).map((r) => (
                                <Cell key={r.key} fill={r.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-semibold tabular-nums">{total}</span>
                    <span className="text-xs text-muted-foreground">schedules</span>
                </div>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {rows.map((r) => (
                    <li key={r.key} className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                        <span className="text-muted-foreground">{r.name}</span>
                        <span className="ml-auto font-semibold tabular-nums">{r.value}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function DeliveryChart({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
    if (total === 0) return <div style={{ height: 256 }}><EmptyChart text="No messages in this range" /></div>

    const rows = (Object.keys(MESSAGE_STATUS) as (keyof typeof MESSAGE_STATUS)[]).map((k) => ({
        key: k,
        name: MESSAGE_STATUS[k].label,
        color: MESSAGE_STATUS[k].color,
        value: byStatus[k] ?? 0,
    }))

    return (
        <div className="w-full text-muted-foreground" style={{ height: 256 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="currentColor" strokeOpacity={0.12} />
                    <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={78} tick={axisTick} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} />
                    <Bar dataKey="value" name="Messages" radius={[0, 8, 8, 0]} barSize={20}>
                        {rows.map((r) => (
                            <Cell key={r.key} fill={r.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function ChannelsAndFailures({ byChannel, failures, total }: {
    byChannel: Record<string, number>
    failures: FailureItem[]
    total: number
}) {
    if (total === 0) return <div style={{ height: 256 }}><EmptyChart text="No messages in this range" /></div>

    const channels = Object.entries(byChannel)
    const channelTotal = channels.reduce((sum, [, v]) => sum + v, 0)

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                {channels.map(([key, value]) => {
                    const share = channelTotal > 0 ? (value / channelTotal) * 100 : 0
                    return (
                        <div key={key}>
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-medium">{CHANNEL_LABEL[key] ?? key}</span>
                                <span className="tabular-nums text-muted-foreground">{value} · {Math.round(share)}%</span>
                            </div>
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-[#4c8c62]" style={{ width: `${share}%` }} />
                            </div>
                        </div>
                    )
                })}
            </div>

            <div>
                <p className="text-xs font-semibold">Top failure reasons</p>
                {failures.length === 0 ? (
                    <p className="mt-2 rounded-xl bg-muted/60 px-3 py-3 text-xs text-muted-foreground">No failed messages in this range.</p>
                ) : (
                    <ol className="mt-2 flex flex-col gap-2">
                        {failures.map((f, i) => {
                            const info = explainFailure(f.code, f.detail)
                            const tone = FAILURE_TONE[info.tone]
                            return (
                                <li key={f.code ?? i} className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs">
                                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">{i + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium">{info.title}</p>
                                        <p className="mt-0.5 text-muted-foreground">{info.hint}</p>
                                        <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.cls}`}>
                                            {tone.label}
                                        </span>
                                        {(f.code || f.detail) && (
                                            <details className="mt-1.5 text-muted-foreground">
                                                <summary className="cursor-pointer">Technical details</summary>
                                                <p className="mt-1 break-words">
                                                    {f.code && <span className="font-mono">{f.code}</span>}
                                                    {f.code && f.detail && ' · '}
                                                    {f.detail}
                                                </p>
                                            </details>
                                        )}
                                    </div>
                                    <span className="font-semibold tabular-nums">{f.count}</span>
                                </li>
                            )
                        })}
                    </ol>
                )}
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------
   Tables
   ------------------------------------------------------------------ */
function RateBar({ rate }: { rate: number | null }) {
    return (
        <div className="flex min-w-32 items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[#4c8c62]" style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} />
            </div>
            <span className="text-xs tabular-nums">{pct(rate)}</span>
        </div>
    )
}

const th = 'whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground'
const td = 'px-3 py-3 align-middle'

function ZonesTable({ zones }: { zones: ZoneRow[] }) {
    if (zones.length === 0) {
        return <EmptyChart text="No zones yet" />
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                <tr>
                    <th className={th}>Zone</th>
                    <th className={th}>Collection day</th>
                    <th className={`${th} text-right`}>Residents</th>
                    <th className={`${th} text-right`}>Schedules</th>
                    <th className={th}>Completion</th>
                    <th className={`${th} text-right`}>Collected</th>
                    <th className={`${th} text-right`}>Missed</th>
                </tr>
                </thead>
                <tbody>
                {zones.map((z) => (
                    <tr key={z.id} className="border-t">
                        <td className={td}>
                                <span className="flex items-center gap-2 font-medium">
                                    <MapIcon size={14} className="shrink-0 text-[#4c8c62]" />
                                    {z.name}
                                </span>
                        </td>
                        <td className={`${td} text-muted-foreground`}>{dayName(z.collectionDay)}</td>
                        <td className={`${td} text-right tabular-nums`}>{z.residents}</td>
                        <td className={`${td} text-right tabular-nums`}>{z.schedules}</td>
                        <td className={td}><RateBar rate={z.completionRate} /></td>
                        <td className={`${td} text-right tabular-nums`}>{z.collected}</td>
                        <td className={`${td} text-right tabular-nums ${z.missed > 0 ? 'font-semibold text-red-600' : ''}`}>{z.missed}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    )
}

function TrucksTable({ report }: { report: TrucksReport | null }) {
    if (!report || report.trucks.length === 0) {
        return <EmptyChart text="No trucks yet" />
    }
    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr>
                        <th className={th}>Truck</th>
                        <th className={th}>Driver</th>
                        <th className={th}>Status</th>
                        <th className={`${th} text-right`}>Schedules</th>
                        <th className={th}>Completion</th>
                    </tr>
                    </thead>
                    <tbody>
                    {report.trucks.map((t) => {
                        const pill = TRUCK_PILL[t.status] ?? { label: t.status, cls: 'bg-muted text-muted-foreground' }
                        return (
                            <tr key={t.id} className="border-t">
                                <td className={td}>
                                        <span className="flex items-center gap-2 font-medium">
                                            <TruckIcon size={14} className="shrink-0 text-[#4c8c62]" />
                                            {t.plateNumber}
                                        </span>
                                </td>
                                <td className={`${td} text-muted-foreground`}>{t.driverName || 'No driver'}</td>
                                <td className={td}>
                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${pill.cls}`}>{pill.label}</span>
                                </td>
                                <td className={`${td} text-right tabular-nums`}>{t.schedules}</td>
                                <td className={td}><RateBar rate={t.completionRate} /></td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>
            {report.unassignedSchedules > 0 && (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800">
                    <AlertCircle size={14} className="shrink-0" />
                    {report.unassignedSchedules} {report.unassignedSchedules === 1 ? 'schedule has' : 'schedules have'} no truck assigned in this range.
                </p>
            )}
        </>
    )
}