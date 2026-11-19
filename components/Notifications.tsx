'use client'

import { useEffect, useState } from 'react'
import {
    Bell, Plus, Pencil, Trash2, X, Loader2, Save, Search, Phone, Users,
    CalendarDays, Clock, Send, CheckCircle2, Eye, XCircle, AlertCircle, ListChecks,
    ChevronLeft, ChevronRight,
} from 'lucide-react'

// const API_URL = 'http://localhost:9123'
// const API_URL = 'https://notification-system-tman.onrender.com'
const API_URL = 'https://notificationsystem-production-bf454768.up.railway.app'
const PAGE_SIZE = 10

type Status = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
type Filter = 'ALL' | Status

type Notification = {
    id: number
    schedule: { id: number }
    resident: { id: number }
    phoneNumber: string
    message: string
    status: Status
    sentAt: string | null
    createdAt: string
}

// DELIVERED and READ are included because the schedules screen already
// treats them as "message went out" statuses coming back from the backend.
const STATUS_STYLES = {
    PENDING:   { label: 'Pending',   icon: Clock,        pill: 'bg-amber-100 text-amber-700',   box: 'bg-amber-100 text-amber-700' },
    SENT:      { label: 'Sent',      icon: Send,         pill: 'bg-blue-100 text-blue-700',     box: 'bg-blue-100 text-blue-700' },
    DELIVERED: { label: 'Delivered', icon: CheckCircle2, pill: 'bg-[#e3f1de] text-[#4c8c62]',   box: 'bg-[#173a2e] text-[#d8ed65]' },
    READ:      { label: 'Read',      icon: Eye,          pill: 'bg-[#e3f1de] text-[#4c8c62]',   box: 'bg-[#173a2e] text-[#d8ed65]' },
    FAILED:    { label: 'Failed',    icon: XCircle,      pill: 'bg-red-100 text-red-700',       box: 'bg-red-100 text-red-600' },
} as const

// Same palette tokens as the other tabs, plus a red icon variant for failures
const TONES = {
    light:  { card: 'bg-card border', icon: 'bg-[#e3f1de] text-[#4c8c62]', label: 'text-muted-foreground' },
    dark:   { card: 'bg-[#173a2e] text-white', icon: 'bg-[#d8ed65] text-[#173a2e]', label: 'text-[#b6cbbd]' },
    lime:   { card: 'bg-[#d8ed65] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#d8ed65]', label: 'text-[#3c5b40]' },
    orange: { card: 'bg-[#f5ad62] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#f5ad62]', label: 'text-[#5a3a14]' },
    alert:  { card: 'bg-card border', icon: 'bg-red-100 text-red-600', label: 'text-muted-foreground' },
} as const

const ANIMATIONS = `
@keyframes nt-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.nt-in   { animation: nt-fade-up .5s cubic-bezier(.2,.7,.2,1) backwards; }
.nt-lift { transition: transform .25s ease, box-shadow .25s ease; }
.nt-lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(23,58,46,.35); }
@media (prefers-reduced-motion: reduce) {
  .nt-in { animation: none !important; }
  .nt-lift { transition: none; }
}
`

function formatDateTime(iso: string | null) {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-KE', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
}

function toLocalInput(iso: string | null) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [formError, setFormError] = useState('')

    const [filter, setFilter] = useState<Filter>('ALL')
    const [query, setQuery] = useState('')
    const [page, setPage] = useState(1)

    const [showForm, setShowForm] = useState(false)
    const [editingNotification, setEditingNotification] = useState<Notification | null>(null)

    const [scheduleId, setScheduleId] = useState('')
    const [residentId, setResidentId] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [message, setMessage] = useState('')
    const [status, setStatus] = useState<Status>('PENDING')
    const [sentAt, setSentAt] = useState('')

    // Jump back to page 1 whenever the filter or search changes
    useEffect(() => {
        setPage(1)
    }, [filter, query])

    useEffect(() => {
        fetchNotifications()
    }, [])

    async function fetchNotifications() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_URL}/notifications`, { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch notifications')
            setNotifications(await res.json())
        } catch (err) {
            console.error(err)
            setError('Could not load notifications. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    function resetForm() {
        setScheduleId('')
        setResidentId('')
        setPhoneNumber('')
        setMessage('')
        setStatus('PENDING')
        setSentAt('')
        setEditingNotification(null)
        setFormError('')
        setShowForm(false)
    }

    function startEdit(notification: Notification) {
        setEditingNotification(notification)
        setScheduleId(String(notification.schedule.id))
        setResidentId(String(notification.resident.id))
        setPhoneNumber(notification.phoneNumber)
        setMessage(notification.message)
        setStatus(notification.status)
        setSentAt(toLocalInput(notification.sentAt))
        setFormError('')
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setFormError('')

        // Nested objects are required here because schedule/resident are
        // @ManyToOne relations on the backend, not flat foreign key fields.
        const payload = {
            schedule: { id: Number(scheduleId) },
            resident: { id: Number(residentId) },
            phoneNumber,
            message,
            status,
            sentAt: sentAt ? new Date(sentAt).toISOString() : null,
        }

        try {
            const url = editingNotification
                ? `${API_URL}/notifications/${editingNotification.id}`
                : `${API_URL}/notifications`
            const method = editingNotification ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const text = await res.text()
                console.error('Save notification failed:', res.status, text)
                setFormError('Could not save the notification. Check the schedule and resident IDs, then try again.')
                return
            }

            await fetchNotifications()
            resetForm()
        } catch (err) {
            console.error(err)
            setFormError('Could not save the notification. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this notification?')) return
        setError('')
        try {
            const res = await fetch(`${API_URL}/notifications/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!res.ok) throw new Error('Failed to delete notification')
            setNotifications((prev) => prev.filter((n) => n.id !== id))
        } catch (err) {
            console.error(err)
            setError('Could not delete the notification. Please try again.')
        }
    }

    // ---- derived data ----
    const count = (st: Status) => notifications.filter((n) => n.status === st).length
    const pendingCount = count('PENDING')
    const failedCount = count('FAILED')
    const deliveredCount = count('DELIVERED')
    const readCount = count('READ')
    const sentCount = count('SENT')
    const wentOut = sentCount + deliveredCount + readCount

    const filters: { key: Filter; label: string; count: number }[] = [
        { key: 'ALL', label: 'All', count: notifications.length },
        { key: 'PENDING', label: 'Pending', count: pendingCount },
        { key: 'SENT', label: 'Sent', count: sentCount },
        { key: 'DELIVERED', label: 'Delivered', count: deliveredCount },
        { key: 'READ', label: 'Read', count: readCount },
        { key: 'FAILED', label: 'Failed', count: failedCount },
    ]

    const q = query.trim().toLowerCase()
    const visible = [...notifications]
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        .filter((n) => filter === 'ALL' || n.status === filter)
        .filter((n) => !q || n.phoneNumber.toLowerCase().includes(q) || n.message.toLowerCase().includes(q))

    // Pagination: clamp the page so deleting the last item on a page doesn't leave you on an empty one
    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const paged = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    const inputCls =
        'mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-[#6b9d72]'

    return (
        <>
            <style>{ANIMATIONS}</style>

            {/* Header banner */}
            <section className="nt-in relative mb-6 overflow-hidden rounded-3xl bg-[#173a2e] p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#d8ed65]/15 blur-2xl" />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#f5ad62]/15 blur-2xl" />
                <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d8ed65] text-[#173a2e]">
                            <Bell size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notifications</h2>
                            <p className="mt-1 text-sm text-[#c1d2c7]">
                                {notifications.length === 0
                                    ? 'Track every pickup message sent to residents.'
                                    : `${wentOut} of ${notifications.length} messages have gone out${failedCount > 0 ? `, ${failedCount} failed` : ''}`}
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
                        <Plus size={16} /> New notification
                    </button>
                </div>
            </section>

            {error && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                </div>
            )}

            {/* Stat cards */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat tone="light" icon={Bell} label="Total messages" value={notifications.length} detail="All notifications" delay={0} />
                <Stat tone="orange" icon={Clock} label="Pending" value={pendingCount} detail="Waiting to be sent" delay={70} />
                <Stat tone="dark" icon={CheckCircle2} label="Sent" value={wentOut} detail={`${readCount} read by residents`} delay={140} />
                <Stat tone="alert" icon={XCircle} label="Failed" value={failedCount} detail={failedCount > 0 ? 'Need a retry' : 'Nothing to fix'} delay={210} />
            </section>

            {/* Create / edit form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="nt-in mt-6 rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-[#e3f1de] text-[#4c8c62]">
                                {editingNotification ? <Pencil size={18} /> : <Plus size={18} />}
                            </div>
                            <div>
                                <h3 className="font-semibold">{editingNotification ? 'Edit notification' : 'New notification'}</h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {editingNotification
                                        ? `Updating notification #${editingNotification.id}`
                                        : 'Link a schedule and resident, then write the message'}
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
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><CalendarDays size={15} className="text-[#4c8c62]" />Schedule ID</span>
                            <input type="number" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} required className={inputCls} />
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><Users size={15} className="text-[#4c8c62]" />Resident ID</span>
                            <input type="number" value={residentId} onChange={(e) => setResidentId(e.target.value)} required className={inputCls} />
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><Phone size={15} className="text-[#4c8c62]" />Phone number</span>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                required
                                placeholder="+254700000000"
                                className={inputCls}
                            />
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><ListChecks size={15} className="text-[#4c8c62]" />Status</span>
                            <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputCls}>
                                {(Object.keys(STATUS_STYLES) as Status[]).map((s) => (
                                    <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="text-sm font-medium sm:col-span-2">
                            <span className="flex items-center gap-2"><Bell size={15} className="text-[#4c8c62]" />Message</span>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                required
                                rows={3}
                                placeholder="e.g. Garbage collection in your zone is tomorrow morning. Please put bins out by 7am."
                                className={inputCls}
                            />
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><Clock size={15} className="text-[#4c8c62]" />Sent at</span>
                            <input type="datetime-local" value={sentAt} onChange={(e) => setSentAt(e.target.value)} className={inputCls} />
                        </label>
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
                            {editingNotification ? 'Save changes' : 'Create notification'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <section className="nt-in mt-6 rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '200ms' }}>
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                        <h3 className="font-semibold">All notifications</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Newest first, with delivery status</p>
                    </div>
                    <div className="flex flex-col gap-3 xl:items-end">
                        <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 transition focus-within:border-[#6b9d72] sm:w-64">
                            <Search size={15} className="shrink-0 text-muted-foreground" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search phone or message"
                                aria-label="Search notifications"
                                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                            />
                        </label>
                        <div className="inline-flex flex-wrap rounded-xl border bg-background p-1">
                            {filters.map((f) => (
                                <button
                                    key={f.key}
                                    onClick={() => setFilter(f.key)}
                                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                        filter === f.key ? 'bg-[#173a2e] text-white' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {f.label}
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === f.key ? 'bg-white/15' : 'bg-muted'}`}>
                                        {f.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Loading notifications...
                        </div>
                    ) : visible.length === 0 ? (
                        <EmptyState
                            icon={Bell}
                            title={notifications.length === 0 ? 'No notifications yet' : 'No notifications match'}
                            subtitle={
                                notifications.length === 0
                                    ? 'Messages appear here when you notify a zone from Schedules.'
                                    : 'Try a different search or filter.'
                            }
                        />
                    ) : (
                        paged.map((n, i) => (
                            <NotificationRow
                                key={n.id}
                                notification={n}
                                delay={Math.min(i, 8) * 50}
                                onEdit={() => startEdit(n)}
                                onDelete={() => handleDelete(n.id)}
                            />
                        ))
                    )}
                </div>

                {!loading && (
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

function Stat({ icon: Icon, label, value, detail, tone, delay }: {
    icon: typeof Bell; label: string; value: number; detail: string
    tone: keyof typeof TONES; delay: number
}) {
    const t = TONES[tone]
    return (
        <div className={`nt-in nt-lift rounded-2xl p-5 shadow-sm ${t.card}`} style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${t.icon}`}><Icon size={19} /></div>
            <p className={`mt-5 text-sm ${t.label}`}>{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            <p className={`mt-1 text-xs ${t.label}`}>{detail}</p>
        </div>
    )
}

function NotificationRow({ notification: n, delay, onEdit, onDelete }: {
    notification: Notification
    delay: number
    onEdit: () => void
    onDelete: () => void
}) {
    // Fall back to PENDING styling if the backend ever returns a status we don't know yet
    const st = STATUS_STYLES[n.status] ?? STATUS_STYLES.PENDING
    const StatusIcon = st.icon
    const when = formatDateTime(n.sentAt ?? n.createdAt)

    return (
        <div className="nt-in nt-lift rounded-xl bg-muted/60 p-3" style={{ animationDelay: `${delay}ms` }}>
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${st.box}`}>
                    <StatusIcon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
                        <span className="flex items-center gap-1.5"><Phone size={14} className="text-[#4c8c62]" />{n.phoneNumber}</span>
                        <span className="flex items-center gap-1.5"><Users size={14} className="text-[#4c8c62]" />Resident #{n.resident?.id}</span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock size={11} />
                        {n.sentAt ? 'Sent' : 'Created'} {when}
                        <span className="mx-1">·</span>
                        <CalendarDays size={11} />
                        Schedule #{n.schedule?.id}
                    </p>
                </div>

                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${st.pill}`}>
                    <StatusIcon size={12} />
                    {st.label}
                </span>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onEdit}
                        aria-label={`Edit notification ${n.id}`}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-background hover:text-foreground"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={onDelete}
                        aria-label={`Delete notification ${n.id}`}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof Bell; title: string; subtitle: string }) {
    return (
        <div className="w-full rounded-xl bg-muted/60 p-8 text-center">
            <Icon className="mx-auto text-muted-foreground" size={26} />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
    )
}

function Pagination({ page, totalPages, total, pageSize, onChange }: {
    page: number; totalPages: number; total: number; pageSize: number
    onChange: (p: number) => void
}) {
    if (total <= pageSize) return null

    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)

    // 1 … 4 5 6 … 12 style list
    const items: (number | '…')[] = []
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) items.push(p)
        else if (items[items.length - 1] !== '…') items.push('…')
    }

    return (
        <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
            <p className="text-xs text-muted-foreground">
                Showing {from}–{to} of {total}
            </p>
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
                            aria-current={it === page ? 'page' : undefined}
                            className={`min-w-9 rounded-lg px-3 py-2 text-xs font-semibold transition ${
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
        </div>
    )
}