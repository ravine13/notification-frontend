'use client'

import { useEffect, useRef, useState } from 'react'
import {
    CalendarDays, Plus, Pencil, Trash2, X, Loader2, MessageSquare, Send, Save,
    CheckCircle2, Clock, Ban, Truck as TruckIcon, Map as MapIcon, ListChecks,
    AlertCircle, CalendarCheck, ChevronDown, ChevronLeft, ChevronRight, Check, Info,
} from 'lucide-react'

// const API_URL = 'http://localhost:9123'
// const API_URL = 'https://notification-system-tman.onrender.com'
const API_URL = 'https://notificationsystem-production-bf454768.up.railway.app'
const PAGE_SIZE = 10

type Status = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type Filter = 'ALL' | 'OVERDUE' | Status
type Channel = 'SMS' | 'WHATSAPP'
type NoticeType = 'SCHEDULED' | 'UPDATED' | 'CANCELLED'

type Truck = {
    id: number
    plateNumber: string
    model?: string
    driverName?: string
    status: 'AVAILABLE' | 'IN_SERVICE' | 'MAINTENANCE'
}

type Zone = { id: number; name: string; description?: string }

type Schedules = {
    id: number
    zone: { id: number }
    truck?: Truck | null
    collectionDate: string
    status: Status
    createdAt: string
    updatedAt: string
}

type NotificationRecord = {
    id: number
    schedule: { id: number }
    resident?: { id: number }
    channel?: Channel
    noticeType?: NoticeType
    noticeDate?: string
    status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED' | 'READ'
}

type SendProgress = { sent: number; failed: number; total: number }

// All notifications that belong to one schedule (every channel and notice type)
async function fetchScheduleNotifications(scheduleId: number): Promise<NotificationRecord[]> {
    const res = await fetch(`${API_URL}/notifications/schedule/${scheduleId}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to load notifications')
    return res.json()
}

const ANIMATIONS = `
@keyframes sch-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes sch-bar     { from { width: 0; } }
.sch-in   { animation: sch-fade-up .5s cubic-bezier(.2,.7,.2,1) backwards; }
.sch-lift { transition: transform .25s ease, box-shadow .25s ease; }
.sch-lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(23,58,46,.35); }
.sch-bar-fill { transition: width .5s ease; animation: sch-bar .6s ease backwards; }
@media (prefers-reduced-motion: reduce) {
  .sch-in, .sch-bar-fill { animation: none !important; transition: none; }
  .sch-lift { transition: none; }
}
`

const STATUS_STYLES = {
    SCHEDULED:   { label: 'Scheduled',   icon: Clock,        pill: 'bg-amber-100 text-amber-700',   box: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
    IN_PROGRESS: { label: 'In progress', icon: TruckIcon,    pill: 'bg-blue-100 text-blue-700',     box: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
    COMPLETED:   { label: 'Completed',   icon: CheckCircle2, pill: 'bg-[#e3f1de] text-[#4c8c62]',   box: 'bg-[#173a2e] text-[#d8ed65]',   dot: 'bg-[#4c8c62]' },
    CANCELLED:   { label: 'Cancelled',   icon: Ban,          pill: 'bg-red-100 text-red-700',       box: 'bg-red-100 text-red-600',       dot: 'bg-red-500' },
} as const

const TONES = {
    light:  { card: 'bg-card border', icon: 'bg-[#e3f1de] text-[#4c8c62]', label: 'text-muted-foreground' },
    dark:   { card: 'bg-[#173a2e] text-white', icon: 'bg-[#d8ed65] text-[#173a2e]', label: 'text-[#b6cbbd]' },
    lime:   { card: 'bg-[#d8ed65] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#d8ed65]', label: 'text-[#3c5b40]' },
    orange: { card: 'bg-[#f5ad62] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#f5ad62]', label: 'text-[#5a3a14]' },
} as const

// Parse YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') is UTC and can show the wrong day)
function formatDate(iso: string) {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return iso
    return new Date(y, m - 1, d).toLocaleDateString('en-KE', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
}

// Local date as YYYY-MM-DD (toISOString is UTC and can be a day off near midnight in Kenya)
function localToday() {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// A pickup is overdue when its date has passed and it is still open
function isOverdue(s: { status: Status; collectionDate: string }, today: string) {
    return (s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS') && s.collectionDate < today
}

// Whole days from one YYYY-MM-DD date to another
function daysBetween(fromIso: string, toIso: string) {
    const [fy, fm, fd] = fromIso.split('-').map(Number)
    const [ty, tm, td] = toIso.split('-').map(Number)
    return Math.round((new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86400000)
}

export default function Schedules() {
    const [schedules, setSchedules] = useState<Schedules[]>([])
    const [trucks, setTrucks] = useState<Truck[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [formError, setFormError] = useState('')
    const [filter, setFilter] = useState<Filter>('ALL')
    const [page, setPage] = useState(1)

    const [showForm, setShowForm] = useState(false)
    const [editingSchedule, setEditingSchedule] = useState<Schedules | null>(null)

    const [zoneId, setZoneId] = useState('')
    const [truckId, setTruckId] = useState('')
    const [collectionDate, setCollectionDate] = useState('')
    const [status, setStatus] = useState<Status>('SCHEDULED')

    const [sendingId, setSendingId] = useState<number | null>(null)
    const [sendProgress, setSendProgress] = useState<SendProgress | null>(null)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        fetchSchedules()
        fetchTrucks()
        fetchZones()
        // Stop polling if the user leaves this tab mid-send
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [])

    async function fetchSchedules() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_URL}/schedules`, { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch schedules')
            setSchedules(await res.json())
        } catch (err) {
            console.error(err)
            setError('Could not load schedules. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    async function fetchTrucks() {
        try {
            const res = await fetch(`${API_URL}/trucks`, { credentials: 'include' })
            if (res.ok) setTrucks(await res.json())
        } catch (err) {
            console.error(err)
        }
    }

    async function fetchZones() {
        try {
            const res = await fetch(`${API_URL}/zones`, { credentials: 'include' })
            if (res.ok) setZones(await res.json())
        } catch (err) {
            console.error(err)
        }
    }

    function resetForm() {
        setZoneId('')
        setTruckId('')
        setCollectionDate('')
        setStatus('SCHEDULED')
        setEditingSchedule(null)
        setFormError('')
        setShowForm(false)
    }

    function startEdit(schedule: Schedules) {
        setEditingSchedule(schedule)
        setZoneId(String(schedule.zone.id))
        setTruckId(schedule.truck ? String(schedule.truck.id) : '')
        setCollectionDate(schedule.collectionDate)
        setStatus(schedule.status)
        setFormError('')
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!zoneId) {
            setFormError('Please pick a zone.')
            return
        }
        setFormError('')
        setNotice('')

        // Same rules as the backend: cancelling sends a CANCELLED notice, a new
        // date on a live schedule sends an UPDATED notice.
        const cancelling = !!editingSchedule && status === 'CANCELLED' && editingSchedule.status !== 'CANCELLED'
        const dateChanged = !!editingSchedule && editingSchedule.collectionDate !== collectionDate
        const willNotify = cancelling || (dateChanged && status !== 'CANCELLED')

        // Warn first if residents were already told about this schedule
        if (editingSchedule && willNotify) {
            try {
                const before = await fetchScheduleNotifications(editingSchedule.id)
                if (before.some((n) => n.status !== 'FAILED')) {
                    const what = cancelling ? 'a cancellation message' : 'a message with the new date'
                    const ok = confirm(
                        `Residents were already notified about this schedule.\n\nSaving will send them ${what}. Continue?`
                    )
                    if (!ok) return
                }
            } catch (err) {
                // If the check fails, still let the save go ahead
                console.error(err)
            }
        }

        setSaving(true)

        const payload = {
            zone: { id: Number(zoneId) },
            truck: truckId ? { id: Number(truckId) } : null,
            collectionDate,
            status,
        }

        try {
            const url = editingSchedule
                ? `${API_URL}/schedules/${editingSchedule.id}`
                : `${API_URL}/schedules`
            const method = editingSchedule ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const text = await res.text()
                console.error('Save schedule failed:', res.status, text)
                setFormError(
                    res.status === 409
                        ? 'That truck is already booked on this date.'
                        : 'Could not save the schedule.'
                )
                return
            }

            // Tell the admin how many residents were messaged about the change
            let message = ''
            if (editingSchedule && willNotify) {
                try {
                    const type: NoticeType = cancelling ? 'CANCELLED' : 'UPDATED'
                    const after = await fetchScheduleNotifications(editingSchedule.id)
                    const rows = after.filter((n) => n.noticeType === type && n.noticeDate === collectionDate)
                    const failed = rows.filter((n) => n.status === 'FAILED').length
                    const about = cancelling ? 'the cancellation' : 'the new date'
                    message =
                        rows.length === 0
                            ? 'Schedule saved. Residents had not been notified yet, so no message was sent.'
                            : `Schedule saved. ${rows.length} resident${rows.length === 1 ? '' : 's'} messaged about ${about}` +
                            (failed > 0 ? `, ${failed} failed.` : '.')
                } catch (err) {
                    console.error(err)
                }
            }

            await fetchSchedules()
            resetForm()
            if (message) setNotice(message)
        } catch (err) {
            console.error(err)
            setFormError('Could not save the schedule.')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this schedule?')) return
        setError('')
        setNotice('')
        try {
            const res = await fetch(`${API_URL}/schedules/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            })

            if (!res.ok) {
                let msg = 'Could not delete the schedule. Please try again.'
                if (res.status === 409) {
                    const data = await res.json().catch(() => null)
                    msg =
                        typeof data?.message === 'string'
                            ? data.message
                            : "This schedule already has notifications, so it can't be deleted. Cancel it instead."
                }
                setError(msg)
                return
            }

            setSchedules((prev) => prev.filter((s) => s.id !== id))
        } catch (err) {
            console.error(err)
            setError('Could not delete the schedule. Please try again.')
        }
    }

    // Quick fix for an overdue pickup that actually happened: mark it completed
    async function markCompleted(s: Schedules) {
        if (!confirm('Mark this pickup as completed?')) return
        setError('')
        setNotice('')
        try {
            const res = await fetch(`${API_URL}/schedules/${s.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    zone: { id: s.zone.id },
                    truck: s.truck ? { id: s.truck.id } : null,
                    collectionDate: s.collectionDate,
                    status: 'COMPLETED',
                }),
            })
            if (!res.ok) throw new Error('Failed to update schedule')
            await fetchSchedules()
            setNotice(`Marked as completed: ${zoneName(s.zone?.id)}, ${formatDate(s.collectionDate)}.`)
        } catch (err) {
            console.error(err)
            setError('Could not update the schedule. Please try again.')
        }
    }

    // Queues zone notifications, then polls until none of this send is still PENDING.
    async function sendZoneNotifications(scheduleId: number, channel: Channel) {
        if (sendingId !== null) return
        setSendingId(scheduleId)
        setSendProgress(null)
        setError('')
        setNotice('')

        const date = schedules.find((s) => s.id === scheduleId)?.collectionDate

        try {
            const res = await fetch(
                `${API_URL}/schedules/${scheduleId}/notify?channel=${channel}`,
                { method: 'POST', credentials: 'include' }
            )
            if (!res.ok) {
                const text = await res.text()
                throw new Error(`Failed to queue notifications: ${res.status} ${text}`)
            }
            const data = await res.json()
            const total = data.queued as number

            // Tell the admin why fewer (or no) messages went out
            if (data.duplicatesPrevented > 0 && typeof data.message === 'string') {
                setNotice(data.message)
            }

            if (total === 0) {
                setSendProgress({ sent: 0, failed: 0, total: 0 })
                setSendingId(null)
                return
            }

            if (pollRef.current) clearInterval(pollRef.current)
            pollRef.current = setInterval(async () => {
                try {
                    const all = await fetchScheduleNotifications(scheduleId)
                    // Only this send: the initial notice, on this channel, for this date
                    const mine = all.filter(
                        (n) =>
                            n.channel === channel &&
                            n.noticeType === 'SCHEDULED' &&
                            (!date || n.noticeDate === date)
                    )
                    const pending = mine.filter((n) => n.status === 'PENDING').length
                    const settled = Math.max(0, total - pending)
                    const failed = Math.min(mine.filter((n) => n.status === 'FAILED').length, settled)
                    setSendProgress({ sent: settled - failed, failed, total })

                    if (pending === 0) {
                        if (pollRef.current) clearInterval(pollRef.current)
                        setSendingId(null)
                    }
                } catch (err) {
                    console.error(err)
                }
            }, 2000)
        } catch (err) {
            console.error(err)
            setError('Could not send notifications. Please try again.')
            setSendingId(null)
        }
    }

    // Trucks already booked on the chosen date (ignoring this schedule and cancelled ones)
    const bookedTruckIds = new Set(
        schedules
            .filter(
                (s) =>
                    s.collectionDate === collectionDate &&
                    s.id !== editingSchedule?.id &&
                    s.status !== 'CANCELLED' &&
                    s.truck
            )
            .map((s) => s.truck!.id)
    )

    const zoneName = (id?: number) => zones.find((z) => z.id === id)?.name ?? `Zone #${id}`

    const zoneOptions: Opt[] = zones.map((z) => ({
        value: String(z.id),
        label: z.name,
        sub: z.description,
    }))

    const truckOptions: Opt[] = trucks.map((t) => {
        const maintenance = t.status === 'MAINTENANCE'
        const booked = bookedTruckIds.has(t.id)
        return {
            value: String(t.id),
            label: t.plateNumber,
            sub: `${t.driverName || 'No driver'}${t.model ? ` · ${t.model}` : ''}`,
            disabled: maintenance || booked,
            badge: maintenance
                ? { text: 'Maintenance', cls: 'bg-red-100 text-red-700' }
                : booked
                    ? { text: 'Booked that day', cls: 'bg-amber-100 text-amber-700' }
                    : { text: 'Available', cls: 'bg-[#d8ed65] text-[#173a2e]' },
        }
    })

    // Status options: a colored dot matches the status pills in the list below
    const statusOptions: Opt[] = (Object.keys(STATUS_STYLES) as Status[]).map((k) => ({
        value: k,
        label: STATUS_STYLES[k].label,
        dot: STATUS_STYLES[k].dot,
    }))

    const count = (st: Status) => schedules.filter((s) => s.status === st).length
    const scheduledCount = count('SCHEDULED')
    const inProgressCount = count('IN_PROGRESS')
    const completedCount = count('COMPLETED')
    const cancelledCount = count('CANCELLED')
    const today = localToday()
    const overdueCount = schedules.filter((s) => isOverdue(s, today)).length

    // Newest collection date first; id breaks ties so the order stays stable
    const sorted = [...schedules].sort(
        (a, b) => b.collectionDate.localeCompare(a.collectionDate) || b.id - a.id
    )
    const visible =
        filter === 'ALL'
            ? sorted
            : filter === 'OVERDUE'
                ? sorted.filter((s) => isOverdue(s, today))
                : sorted.filter((s) => s.status === filter)

    // Pagination: clamp the page so deleting the last item on a page doesn't leave you on an empty one
    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const paged = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    function changeFilter(next: Filter) {
        setFilter(next)
        setPage(1)
    }

    const filters: { key: Filter; label: string; count: number }[] = [
        { key: 'ALL', label: 'All', count: schedules.length },
        { key: 'SCHEDULED', label: 'Scheduled', count: scheduledCount },
        { key: 'IN_PROGRESS', label: 'In progress', count: inProgressCount },
        { key: 'COMPLETED', label: 'Completed', count: completedCount },
        { key: 'CANCELLED', label: 'Cancelled', count: cancelledCount },
        { key: 'OVERDUE', label: 'Overdue', count: overdueCount },
    ]

    const inputCls =
        'mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-[#6b9d72]'

    return (
        <>
            <style>{ANIMATIONS}</style>

            {/* Header banner */}
            <section className="sch-in relative mb-6 overflow-hidden rounded-3xl bg-[#173a2e] p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#d8ed65]/15 blur-2xl" />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#f5ad62]/15 blur-2xl" />
                <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d8ed65] text-[#173a2e]">
                            <CalendarDays size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Schedules</h2>
                            <p className="mt-1 text-sm text-[#c1d2c7]">
                                {schedules.length === 0
                                    ? 'Plan zone pickups, assign trucks and notify residents.'
                                    : `${completedCount} of ${schedules.length} schedules completed${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            resetForm()
                            setShowForm(true)
                        }}
                        className="flex w-fit items-center gap-2 rounded-xl bg-[#d8ed65] px-4 py-3 text-sm font-semibold text-[#173a2e] transition hover:brightness-95"
                    >
                        <Plus size={16} /> New schedule
                    </button>
                </div>
            </section>

            {error && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                </div>
            )}

            {notice && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <Info size={16} className="shrink-0" />
                    {notice}
                </div>
            )}

            {/* Stat cards */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat tone="light" icon={ListChecks} label="Total schedules" value={schedules.length} detail={`${cancelledCount} cancelled`} delay={0} />
                <Stat tone="orange" icon={Clock} label="Scheduled" value={scheduledCount} detail="Upcoming pickups" delay={70} />
                <Stat tone="dark" icon={TruckIcon} label="In progress" value={inProgressCount} detail="Trucks out collecting" delay={140} />
                <Stat tone="lime" icon={CalendarCheck} label="Completed" value={completedCount} detail="Finished pickups" delay={210} />
            </section>

            {/* Create / edit form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="sch-in mt-6 rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-[#e3f1de] text-[#4c8c62]">
                                {editingSchedule ? <Pencil size={18} /> : <Plus size={18} />}
                            </div>
                            <div>
                                <h3 className="font-semibold">{editingSchedule ? 'Edit schedule' : 'New schedule'}</h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {editingSchedule
                                        ? `Updating schedule #${editingSchedule.id}`
                                        : 'Pick a zone and date, then assign a truck'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={resetForm}
                            aria-label="Close form"
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="text-sm font-medium">
                            <span className="flex items-center gap-2"><MapIcon size={15} className="text-[#4c8c62]" />Zone</span>
                            <div className="mt-2">
                                <Picker
                                    options={zoneOptions}
                                    value={zoneId}
                                    onChange={setZoneId}
                                    placeholder={zones.length === 0 ? 'Loading zones...' : 'Select a zone'}
                                    icon={MapIcon}
                                />
                            </div>
                        </div>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><CalendarDays size={15} className="text-[#4c8c62]" />Collection date</span>
                            <input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} required className={inputCls} />
                        </label>

                        <div className="text-sm font-medium sm:col-span-2">
                            <span className="flex items-center gap-2">
                                <TruckIcon size={15} className="text-[#4c8c62]" />
                                Truck
                                {!collectionDate && <span className="text-xs font-normal text-muted-foreground">(pick a date first)</span>}
                            </span>
                            <div className="mt-2">
                                <Picker
                                    options={truckOptions}
                                    value={truckId}
                                    onChange={setTruckId}
                                    placeholder="No truck assigned"
                                    emptyLabel="No truck assigned"
                                    icon={TruckIcon}
                                />
                            </div>
                        </div>

                        <div className="text-sm font-medium sm:col-span-2">
                            <span className="flex items-center gap-2"><ListChecks size={15} className="text-[#4c8c62]" />Status</span>
                            <div className="mt-2">
                                <Picker
                                    options={statusOptions}
                                    value={status}
                                    onChange={(v) => setStatus(v as Status)}
                                    placeholder="Select a status"
                                    icon={ListChecks}
                                />
                            </div>
                        </div>
                    </div>

                    {formError && (
                        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <AlertCircle size={16} className="shrink-0" />
                            {formError}
                        </div>
                    )}

                    <div className="mt-6 flex gap-3">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-muted"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 rounded-xl bg-[#173a2e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245843] disabled:opacity-60"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {editingSchedule ? 'Save changes' : 'Create schedule'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <section className="sch-in mt-6 rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '200ms' }}>
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                        <h3 className="font-semibold">All schedules</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Newest first, with truck and resident notifications</p>
                    </div>
                    <div className="inline-flex flex-wrap rounded-xl border bg-background p-1">
                        {filters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => changeFilter(f.key)}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    filter === f.key ? 'bg-[#173a2e] text-white' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {f.label}
                                <span
                                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                        f.key === 'OVERDUE' && f.count > 0
                                            ? 'bg-red-500 text-white'
                                            : filter === f.key
                                                ? 'bg-white/15'
                                                : 'bg-muted'
                                    }`}
                                >
                                    {f.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Loading schedules...
                        </div>
                    ) : visible.length === 0 ? (
                        <EmptyState
                            icon={CalendarDays}
                            title={schedules.length === 0 ? 'No schedules yet' : 'No schedules in this filter'}
                            subtitle={
                                schedules.length === 0
                                    ? 'Use "New schedule" to plan the first pickup.'
                                    : 'Try a different filter to see other schedules.'
                            }
                        />
                    ) : (
                        paged.map((s, i) => (
                            <ScheduleRow
                                key={s.id}
                                schedule={s}
                                zoneLabel={zoneName(s.zone?.id)}
                                delay={Math.min(i, 8) * 50}
                                sending={sendingId === s.id}
                                anySending={sendingId !== null}
                                progress={sendingId === s.id ? sendProgress : null}
                                overdue={isOverdue(s, today)}
                                daysLate={daysBetween(s.collectionDate, today)}
                                onComplete={() => markCompleted(s)}
                                onSend={(channel) => sendZoneNotifications(s.id, channel)}
                                onEdit={() => startEdit(s)}
                                onDelete={() => handleDelete(s.id)}
                            />
                        ))
                    )}
                </div>

                {!loading && visible.length > 0 && (
                    <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        total={visible.length}
                        pageSize={PAGE_SIZE}
                        onChange={setPage}
                    />
                )}
            </section>
        </>
    )
}

/* ---------- Pagination ---------- */

function Pagination({ page, totalPages, total, pageSize, onChange }: {
    page: number; totalPages: number; total: number; pageSize: number
    onChange: (p: number) => void
}) {
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)

    // 1 … 4 5 6 … 12 style list
    const items: (number | '…')[] = []
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) items.push(p)
        else if (items[items.length - 1] !== '…') items.push('…')
    }

    return (
        <nav
            aria-label="Pagination"
            className="mt-5 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row"
        >
            <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground tabular-nums">{from}–{to}</span> of{' '}
                <span className="font-semibold text-foreground tabular-nums">{total}</span>
            </p>

            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onChange(page - 1)}
                        disabled={page === 1}
                        aria-label="Previous page"
                        className="rounded-lg border p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-40"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    {items.map((it, i) =>
                        it === '…' ? (
                            <span key={`gap-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
                        ) : (
                            <button
                                key={it}
                                onClick={() => onChange(it)}
                                aria-label={`Page ${it}`}
                                aria-current={it === page ? 'page' : undefined}
                                className={`min-w-9 rounded-lg px-3 py-2 text-xs font-semibold tabular-nums transition ${
                                    it === page ? 'bg-[#173a2e] text-white' : 'border text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                {it}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => onChange(page + 1)}
                        disabled={page === totalPages}
                        aria-label="Next page"
                        className="rounded-lg border p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-40"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </nav>
    )
}

/* ---------- Custom dropdown (replaces the native select, which Chrome clips) ---------- */

type Opt = {
    value: string
    label: string
    sub?: string
    disabled?: boolean
    badge?: { text: string; cls: string }
    dot?: string // Tailwind bg class for a small colored dot
}

function Picker({ options, value, onChange, placeholder, emptyLabel, icon: Icon }: {
    options: Opt[]
    value: string
    onChange: (v: string) => void
    placeholder: string
    emptyLabel?: string
    icon: typeof TruckIcon
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('mousedown', onClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [])

    const selected = options.find((o) => o.value === value)

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex w-full items-center gap-3 rounded-xl border bg-background px-3 py-3 text-left text-sm outline-none transition focus:border-[#6b9d72]"
            >
                <Icon size={16} className="shrink-0 text-muted-foreground" />
                {selected?.dot && <span className={`size-2 shrink-0 rounded-full ${selected.dot}`} />}
                <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-muted-foreground'}`}>
                    {selected ? `${selected.label}${selected.sub ? ` · ${selected.sub}` : ''}` : placeholder}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    role="listbox"
                    className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border bg-card p-1 shadow-2xl"
                >
                    {emptyLabel && (
                        <button
                            type="button"
                            onClick={() => { onChange(''); setOpen(false) }}
                            className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted"
                        >
                            {emptyLabel}
                        </button>
                    )}
                    {options.length === 0 && (
                        <p className="px-3 py-2.5 text-sm text-muted-foreground">Nothing to choose yet.</p>
                    )}
                    {options.map((o) => {
                        const isSelected = o.value === value
                        const disabled = o.disabled && !isSelected
                        return (
                            <button
                                key={o.value}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                disabled={disabled}
                                onClick={() => { onChange(o.value); setOpen(false) }}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                            >
                                {o.dot && <span className={`size-2 shrink-0 rounded-full ${o.dot}`} />}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{o.label}</p>
                                    {o.sub && <p className="truncate text-xs text-muted-foreground">{o.sub}</p>}
                                </div>
                                {o.badge && (
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.badge.cls}`}>
                                        {o.badge.text}
                                    </span>
                                )}
                                {isSelected && <Check size={16} className="shrink-0" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function Stat({ icon: Icon, label, value, detail, tone, delay }: {
    icon: typeof ListChecks; label: string; value: number; detail: string
    tone: keyof typeof TONES; delay: number
}) {
    const t = TONES[tone]
    return (
        <div className={`sch-in sch-lift rounded-2xl p-5 shadow-sm ${t.card}`} style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${t.icon}`}><Icon size={19} /></div>
            <p className={`mt-5 text-sm ${t.label}`}>{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            <p className={`mt-1 text-xs ${t.label}`}>{detail}</p>
        </div>
    )
}

function ScheduleRow({
                         schedule: s, zoneLabel, delay, sending, anySending, progress,
                         overdue, daysLate, onSend, onEdit, onDelete, onComplete,
                     }: {
    schedule: Schedules
    zoneLabel: string
    delay: number
    sending: boolean
    anySending: boolean
    progress: SendProgress | null
    overdue: boolean
    daysLate: number
    onSend: (channel: Channel) => void
    onEdit: () => void
    onDelete: () => void
    onComplete: () => void
}) {
    const st = STATUS_STYLES[s.status]
    const StatusIcon = st.icon
    const done = progress ? progress.sent + progress.failed : 0
    const pct = progress && progress.total > 0 ? Math.round((done / progress.total) * 100) : 0

    // No point telling residents about a pickup that is cancelled or already done
    const closed = s.status === 'CANCELLED' || s.status === 'COMPLETED' || overdue
    const closedHint =
        s.status === 'CANCELLED'
            ? 'This schedule is cancelled'
            : s.status === 'COMPLETED'
                ? 'This pickup is already completed'
                : 'The pickup date has passed'

    return (
        <div className="sch-in sch-lift rounded-xl bg-muted/60 p-3" style={{ animationDelay: `${delay}ms` }}>
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${st.box}`}>
                    <StatusIcon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
                        <span className="flex items-center gap-1.5"><MapIcon size={14} className="text-[#4c8c62]" />{zoneLabel}</span>
                        <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-[#4c8c62]" />{formatDate(s.collectionDate)}</span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TruckIcon size={12} />
                        {s.truck
                            ? `${s.truck.plateNumber}${s.truck.driverName ? ` · ${s.truck.driverName}` : ''}`
                            : 'No truck assigned'}
                    </p>
                </div>

                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${st.pill}`}>
                    <StatusIcon size={12} />
                    {st.label}
                </span>

                {overdue && (
                    <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-700">
                        <AlertCircle size={12} />
                        Overdue
                    </span>
                )}

                <div className="flex items-center gap-1">
                    <button
                        disabled={anySending || closed}
                        onClick={() => onSend('SMS')}
                        title={closed ? closedHint : 'Send SMS to zone residents'}
                        aria-label={`Send SMS for schedule ${s.id}`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#39705a] transition hover:bg-[#e3f1de] disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                        {sending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
                        <span className="hidden lg:inline">SMS</span>
                    </button>
                    <button
                        disabled={anySending || closed}
                        onClick={() => onSend('WHATSAPP')}
                        title={closed ? closedHint : 'Send WhatsApp to zone residents'}
                        aria-label={`Send WhatsApp for schedule ${s.id}`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#39705a] transition hover:bg-[#e3f1de] disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                        <Send size={15} />
                        <span className="hidden lg:inline">WhatsApp</span>
                    </button>
                    <button
                        onClick={onEdit}
                        aria-label={`Edit schedule ${s.id}`}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-background hover:text-foreground"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={onDelete}
                        aria-label={`Delete schedule ${s.id}`}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {overdue && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <AlertCircle size={13} />
                        Due {daysLate} day{daysLate === 1 ? '' : 's'} ago and not marked completed
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onComplete}
                            className="flex items-center gap-1.5 rounded-lg bg-[#173a2e] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#245843]"
                        >
                            <CheckCircle2 size={13} />
                            Mark completed
                        </button>
                        <button
                            onClick={onEdit}
                            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted"
                        >
                            <CalendarDays size={13} />
                            Reschedule
                        </button>
                    </div>
                </div>
            )}

            {sending && progress && (
                <div className="mt-3 border-t border-border/60 pt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Send size={12} />
                            {done}/{progress.total} sent
                            {progress.failed > 0 && <span className="text-red-600">· {progress.failed} failed</span>}
                        </span>
                        <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="sch-bar-fill h-full rounded-full bg-[#4c8c62]" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            )}
        </div>
    )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof CalendarDays; title: string; subtitle: string }) {
    return (
        <div className="w-full rounded-xl bg-muted/60 p-8 text-center">
            <Icon className="mx-auto text-muted-foreground" size={26} />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
    )
}