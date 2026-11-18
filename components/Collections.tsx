'use client'

import { useEffect, useState } from 'react'
import {
    PackageCheck, Plus, Pencil, Trash2, X, Loader2, CheckCircle2, AlertTriangle,
    Clock, CalendarDays, Users, Save, ListChecks, Package, AlertCircle,
} from 'lucide-react'

// const API_URL = 'http://localhost:9123'
// const API_URL = 'https://notification-system-tman.onrender.com'
const API_URL = 'https://notificationsystem-production-bf454768.up.railway.app'

type Status = 'PENDING' | 'COLLECTED' | 'MISSED'
type Filter = 'ALL' | Status

type Collection = {
    id: number
    scheduleId: number
    residentId: number
    status: Status
    collectedAt: string | null
    createdAt: string
}

const ANIMATIONS = `
@keyframes col-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.col-in   { animation: col-fade-up .5s cubic-bezier(.2,.7,.2,1) backwards; }
.col-lift { transition: transform .25s ease, box-shadow .25s ease; }
.col-lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(23,58,46,.35); }
@media (prefers-reduced-motion: reduce) {
  .col-in { animation: none !important; }
  .col-lift { transition: none; }
}
`

const STATUS_STYLES = {
    COLLECTED: { label: 'Collected', icon: CheckCircle2, pill: 'bg-[#e3f1de] text-[#4c8c62]', box: 'bg-[#173a2e] text-[#d8ed65]' },
    PENDING:   { label: 'Pending',   icon: Clock,        pill: 'bg-amber-100 text-amber-700', box: 'bg-amber-100 text-amber-700' },
    MISSED:    { label: 'Missed',    icon: AlertTriangle, pill: 'bg-red-100 text-red-700',    box: 'bg-red-100 text-red-600' },
} as const

const TONES = {
    light: { card: 'bg-card border', icon: 'bg-[#e3f1de] text-[#4c8c62]', label: 'text-muted-foreground' },
    lime:  { card: 'bg-[#d8ed65] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#d8ed65]', label: 'text-[#3c5b40]' },
    dark:  { card: 'bg-[#173a2e] text-white', icon: 'bg-[#d8ed65] text-[#173a2e]', label: 'text-[#b6cbbd]' },
    orange: { card: 'bg-[#f5ad62] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#f5ad62]', label: 'text-[#5a3a14]' },
} as const

function formatDateTime(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleString('en-KE', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
}

export default function RoutesCollections() {
    const [collections, setCollections] = useState<Collection[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState<Filter>('ALL')

    const [showForm, setShowForm] = useState(false)
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null)

    const [scheduleId, setScheduleId] = useState('')
    const [residentId, setResidentId] = useState('')
    const [status, setStatus] = useState<Status>('PENDING')
    const [collectedAt, setCollectedAt] = useState('')

    useEffect(() => {
        fetchCollections()
    }, [])

    async function fetchCollections() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_URL}/collections`, { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch collections')
            setCollections(await res.json())
        } catch (err) {
            console.error(err)
            setError('Could not load collections. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    function resetForm() {
        setScheduleId('')
        setResidentId('')
        setStatus('PENDING')
        setCollectedAt('')
        setEditingCollection(null)
        setShowForm(false)
    }

    function startEdit(collection: Collection) {
        setEditingCollection(collection)
        setScheduleId(String(collection.scheduleId))
        setResidentId(String(collection.residentId))
        setStatus(collection.status)
        setCollectedAt(collection.collectedAt ? collection.collectedAt.slice(0, 16) : '')
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setError('')

        const payload = {
            scheduleId: Number(scheduleId),
            residentId: Number(residentId),
            status,
            collectedAt: collectedAt ? new Date(collectedAt).toISOString() : null,
        }

        try {
            const url = editingCollection
                ? `${API_URL}/collections/${editingCollection.id}`
                : `${API_URL}/collections`
            const method = editingCollection ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error('Failed to save collection')

            await fetchCollections()
            resetForm()
        } catch (err) {
            console.error(err)
            setError('Could not save the collection. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this collection?')) return
        setError('')
        try {
            const res = await fetch(`${API_URL}/collections/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!res.ok) throw new Error('Failed to delete collection')
            setCollections((prev) => prev.filter((c) => c.id !== id))
        } catch (err) {
            console.error(err)
            setError('Could not delete the collection. Please try again.')
        }
    }

    const collectedCount = collections.filter((c) => c.status === 'COLLECTED').length
    const pendingCount = collections.filter((c) => c.status === 'PENDING').length
    const missedCount = collections.filter((c) => c.status === 'MISSED').length

    const visible = filter === 'ALL' ? collections : collections.filter((c) => c.status === filter)

    const filters: { key: Filter; label: string; count: number }[] = [
        { key: 'ALL', label: 'All', count: collections.length },
        { key: 'PENDING', label: 'Pending', count: pendingCount },
        { key: 'COLLECTED', label: 'Collected', count: collectedCount },
        { key: 'MISSED', label: 'Missed', count: missedCount },
    ]

    const inputCls =
        'mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-[#6b9d72]'

    return (
        <>
            <style>{ANIMATIONS}</style>

            {/* Header banner */}
            <section className="col-in relative mb-6 overflow-hidden rounded-3xl bg-[#173a2e] p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#d8ed65]/15 blur-2xl" />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#f5ad62]/15 blur-2xl" />
                <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d8ed65] text-[#173a2e]">
                            <PackageCheck size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Collections</h2>
                            <p className="mt-1 text-sm text-[#c1d2c7]">
                                {collections.length === 0
                                    ? 'Track each resident pickup against its schedule.'
                                    : `${collectedCount} of ${collections.length} pickups collected`}
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
                        <Plus size={16} /> New collection
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
                <Stat tone="light" icon={ListChecks} label="Total pickups" value={collections.length} detail="All recorded collections" delay={0} />
                <Stat tone="lime" icon={CheckCircle2} label="Collected" value={collectedCount} detail="Pickups completed" delay={70} />
                <Stat tone="dark" icon={Clock} label="Pending" value={pendingCount} detail="Waiting to be collected" delay={140} />
                <Stat tone="orange" icon={AlertTriangle} label="Missed" value={missedCount} detail="Need follow-up" delay={210} />
            </section>

            {/* Create / edit form */}
            {showForm && (
                <form
                    onSubmit={handleSubmit}
                    className="col-in mt-6 rounded-2xl border bg-card p-5 shadow-sm"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-[#e3f1de] text-[#4c8c62]">
                                {editingCollection ? <Pencil size={18} /> : <Plus size={18} />}
                            </div>
                            <div>
                                <h3 className="font-semibold">
                                    {editingCollection ? 'Edit collection' : 'New collection'}
                                </h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {editingCollection
                                        ? `Updating collection #${editingCollection.id}`
                                        : 'Link a resident to a schedule and set its status'}
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
                            <span className="flex items-center gap-2"><ListChecks size={15} className="text-[#4c8c62]" />Status</span>
                            <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputCls}>
                                <option value="PENDING">Pending</option>
                                <option value="COLLECTED">Collected</option>
                                <option value="MISSED">Missed</option>
                            </select>
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><Clock size={15} className="text-[#4c8c62]" />Collected at</span>
                            <input type="datetime-local" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} className={inputCls} />
                        </label>
                    </div>

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
                            {editingCollection ? 'Save changes' : 'Create collection'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <section className="col-in mt-6 rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '200ms' }}>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                        <h3 className="font-semibold">Pickup records</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Each resident pickup and its current status</p>
                    </div>
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

                <div className="mt-5 flex flex-col gap-3">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Loading collections...
                        </div>
                    ) : visible.length === 0 ? (
                        <EmptyState
                            icon={Package}
                            title={collections.length === 0 ? 'No collections yet' : `No ${filter.toLowerCase()} collections`}
                            subtitle={
                                collections.length === 0
                                    ? 'Use "New collection" to record the first pickup.'
                                    : 'Try a different filter to see other records.'
                            }
                        />
                    ) : (
                        visible.map((c, i) => (
                            <CollectionRow
                                key={c.id}
                                collection={c}
                                delay={Math.min(i, 8) * 50}
                                onEdit={() => startEdit(c)}
                                onDelete={() => handleDelete(c.id)}
                            />
                        ))
                    )}
                </div>
            </section>
        </>
    )
}

function Stat({ icon: Icon, label, value, detail, tone, delay }: {
    icon: typeof ListChecks; label: string; value: number; detail: string
    tone: keyof typeof TONES; delay: number
}) {
    const t = TONES[tone]
    return (
        <div className={`col-in col-lift rounded-2xl p-5 shadow-sm ${t.card}`} style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${t.icon}`}><Icon size={19} /></div>
            <p className={`mt-5 text-sm ${t.label}`}>{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            <p className={`mt-1 text-xs ${t.label}`}>{detail}</p>
        </div>
    )
}

function CollectionRow({ collection: c, delay, onEdit, onDelete }: {
    collection: Collection; delay: number; onEdit: () => void; onDelete: () => void
}) {
    const s = STATUS_STYLES[c.status]
    const StatusIcon = s.icon
    const collectedLabel = formatDateTime(c.collectedAt)

    return (
        <div className="col-in col-lift flex items-center gap-3 rounded-xl bg-muted/60 p-3" style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${s.box}`}>
                <StatusIcon size={18} />
            </div>

            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
                    <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-[#4c8c62]" />Schedule #{c.scheduleId}</span>
                    <span className="flex items-center gap-1.5"><Users size={14} className="text-[#4c8c62]" />Resident #{c.residentId}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={12} />
                    {collectedLabel ? `Collected ${collectedLabel}` : 'Not collected yet'}
                </p>
            </div>

            <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:flex ${s.pill}`}>
                <StatusIcon size={12} />
                {s.label}
            </span>

            <div className="flex items-center gap-1">
                <button
                    onClick={onEdit}
                    aria-label={`Edit collection ${c.id}`}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-background hover:text-foreground"
                >
                    <Pencil size={16} />
                </button>
                <button
                    onClick={onDelete}
                    aria-label={`Delete collection ${c.id}`}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof Package; title: string; subtitle: string }) {
    return (
        <div className="w-full rounded-xl bg-muted/60 p-8 text-center">
            <Icon className="mx-auto text-muted-foreground" size={26} />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
    )
}