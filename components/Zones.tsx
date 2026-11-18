'use client'

import { useEffect, useState } from 'react'
import {
    Map as MapIcon, Plus, Pencil, Trash2, X, Loader2, Save, Search,
    CalendarDays, CalendarCheck, CalendarX, AlertCircle, MapPinned,
} from 'lucide-react'

// const API_URL = 'http://localhost:9123'
// const API_URL = 'https://notification-system-tman.onrender.com'
const API_URL = 'https://notificationsystem-production-bf454768.up.railway.app'

type Zone = {
    id: number
    name: string
    description: string | null
    collectionDay: string | null
    createdAt: string
    updatedAt: string
}

type Filter = 'ALL' | 'ASSIGNED' | 'UNASSIGNED'

const DAYS = [
    { value: 'MONDAY', label: 'Monday' },
    { value: 'TUESDAY', label: 'Tuesday' },
    { value: 'WEDNESDAY', label: 'Wednesday' },
    { value: 'THURSDAY', label: 'Thursday' },
    { value: 'FRIDAY', label: 'Friday' },
    { value: 'SATURDAY', label: 'Saturday' },
    { value: 'SUNDAY', label: 'Sunday' },
] as const

const DAY_LABEL: Record<string, string> = Object.fromEntries(DAYS.map((d) => [d.value, d.label]))

// Same palette tokens as Schedules so every tab feels like one product
const TONES = {
    light:  { card: 'bg-card border', icon: 'bg-[#e3f1de] text-[#4c8c62]', label: 'text-muted-foreground' },
    dark:   { card: 'bg-[#173a2e] text-white', icon: 'bg-[#d8ed65] text-[#173a2e]', label: 'text-[#b6cbbd]' },
    lime:   { card: 'bg-[#d8ed65] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#d8ed65]', label: 'text-[#3c5b40]' },
    orange: { card: 'bg-[#f5ad62] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#f5ad62]', label: 'text-[#5a3a14]' },
} as const

const ANIMATIONS = `
@keyframes zn-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.zn-in   { animation: zn-fade-up .5s cubic-bezier(.2,.7,.2,1) backwards; }
.zn-lift { transition: transform .25s ease, box-shadow .25s ease; }
.zn-lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(23,58,46,.35); }
@media (prefers-reduced-motion: reduce) {
  .zn-in { animation: none !important; }
  .zn-lift { transition: none; }
}
`

export default function Zones() {
    const [zones, setZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [formError, setFormError] = useState('')

    const [filter, setFilter] = useState<Filter>('ALL')
    const [query, setQuery] = useState('')

    const [showForm, setShowForm] = useState(false)
    const [editingZone, setEditingZone] = useState<Zone | null>(null)

    const [zoneName, setZoneName] = useState('')
    const [description, setDescription] = useState('')
    const [collectionDay, setCollectionDay] = useState('')

    useEffect(() => {
        fetchZones()
    }, [])

    async function fetchZones() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_URL}/zones`, { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch zones')
            setZones(await res.json())
        } catch (err) {
            console.error(err)
            setError('Could not load zones. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    function resetForm() {
        setZoneName('')
        setDescription('')
        setCollectionDay('')
        setEditingZone(null)
        setFormError('')
        setShowForm(false)
    }

    function startEdit(zone: Zone) {
        setEditingZone(zone)
        setZoneName(zone.name)
        setDescription(zone.description ?? '')
        setCollectionDay(zone.collectionDay ?? '')
        setFormError('')
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setFormError('')

        const payload = {
            name: zoneName,
            description: description || null,
            collectionDay: collectionDay || null,
        }

        try {
            const url = editingZone ? `${API_URL}/zones/${editingZone.id}` : `${API_URL}/zones`
            const method = editingZone ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const text = await res.text()
                console.error('Save zone failed:', res.status, text)
                setFormError('Could not save the zone. Please try again.')
                return
            }

            await fetchZones()
            resetForm()
        } catch (err) {
            console.error(err)
            setFormError('Could not save the zone. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this zone?')) return
        setError('')
        try {
            const res = await fetch(`${API_URL}/zones/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!res.ok) throw new Error('Failed to delete zone')
            setZones((prev) => prev.filter((z) => z.id !== id))
        } catch (err) {
            console.error(err)
            setError('Could not delete the zone. It may still have schedules attached.')
        }
    }

    // ---- derived data ----
    const assignedCount = zones.filter((z) => z.collectionDay).length
    const unassignedCount = zones.length - assignedCount

    const dayCounts = zones.reduce<Record<string, number>>((acc, z) => {
        if (z.collectionDay) acc[z.collectionDay] = (acc[z.collectionDay] ?? 0) + 1
        return acc
    }, {})
    const busiest = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]

    const filters: { key: Filter; label: string; count: number }[] = [
        { key: 'ALL', label: 'All', count: zones.length },
        { key: 'ASSIGNED', label: 'Has a day', count: assignedCount },
        { key: 'UNASSIGNED', label: 'No day', count: unassignedCount },
    ]

    const q = query.trim().toLowerCase()
    const visible = zones
        .filter((z) => (filter === 'ALL' ? true : filter === 'ASSIGNED' ? !!z.collectionDay : !z.collectionDay))
        .filter((z) => !q || z.name.toLowerCase().includes(q) || (z.description ?? '').toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name))

    const inputCls =
        'mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-[#6b9d72]'

    return (
        <>
            <style>{ANIMATIONS}</style>

            {/* Header banner */}
            <section className="zn-in relative mb-6 overflow-hidden rounded-3xl bg-[#173a2e] p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#d8ed65]/15 blur-2xl" />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#f5ad62]/15 blur-2xl" />
                <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d8ed65] text-[#173a2e]">
                            <MapIcon size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Routes &amp; zones</h2>
                            <p className="mt-1 text-sm text-[#c1d2c7]">
                                {zones.length === 0
                                    ? 'Define the areas your trucks collect from and set their pickup day.'
                                    : `${assignedCount} of ${zones.length} zones have a collection day`}
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
                        <Plus size={16} /> New zone
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
                <Stat tone="light" icon={MapPinned} label="Total zones" value={zones.length} detail="Areas on your network" delay={0} />
                <Stat tone="orange" icon={CalendarCheck} label="Has a day" value={assignedCount} detail="Ready for scheduling" delay={70} />
                <Stat tone="dark" icon={CalendarX} label="No day yet" value={unassignedCount} detail="Need a collection day" delay={140} />
                <Stat
                    tone="lime"
                    icon={CalendarDays}
                    label="Busiest day"
                    value={busiest ? busiest[1] : 0}
                    detail={busiest ? `${DAY_LABEL[busiest[0]] ?? busiest[0]}` : 'No days assigned'}
                    delay={210}
                />
            </section>

            {/* Create / edit form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="zn-in mt-6 rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-[#e3f1de] text-[#4c8c62]">
                                {editingZone ? <Pencil size={18} /> : <Plus size={18} />}
                            </div>
                            <div>
                                <h3 className="font-semibold">{editingZone ? 'Edit zone' : 'New zone'}</h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {editingZone ? `Updating ${editingZone.name}` : 'Name the area and choose its pickup day'}
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
                            <span className="flex items-center gap-2"><MapIcon size={15} className="text-[#4c8c62]" />Zone name</span>
                            <input
                                type="text"
                                value={zoneName}
                                onChange={(e) => setZoneName(e.target.value)}
                                required
                                placeholder="e.g. Kapsoya"
                                className={inputCls}
                            />
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><CalendarDays size={15} className="text-[#4c8c62]" />Collection day</span>
                            <select value={collectionDay} onChange={(e) => setCollectionDay(e.target.value)} className={inputCls}>
                                <option value="">No day assigned</option>
                                {DAYS.map((d) => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="text-sm font-medium sm:col-span-2">
                            <span className="flex items-center gap-2"><MapPinned size={15} className="text-[#4c8c62]" />Description</span>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                placeholder="Estates, streets or landmarks covered (optional)"
                                className={inputCls}
                            />
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
                            {editingZone ? 'Save changes' : 'Create zone'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <section className="zn-in mt-6 rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '200ms' }}>
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                        <h3 className="font-semibold">All zones</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Sorted by name, with collection day</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 transition focus-within:border-[#6b9d72] sm:w-56">
                            <Search size={15} className="shrink-0 text-muted-foreground" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search zones"
                                aria-label="Search zones"
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
                            Loading zones...
                        </div>
                    ) : visible.length === 0 ? (
                        <EmptyState
                            icon={MapIcon}
                            title={zones.length === 0 ? 'No zones yet' : 'No zones match'}
                            subtitle={
                                zones.length === 0
                                    ? 'Use "New zone" to add the first collection area.'
                                    : 'Try a different search or filter.'
                            }
                        />
                    ) : (
                        visible.map((z, i) => (
                            <ZoneRow
                                key={z.id}
                                zone={z}
                                delay={Math.min(i, 8) * 50}
                                onEdit={() => startEdit(z)}
                                onDelete={() => handleDelete(z.id)}
                            />
                        ))
                    )}
                </div>
            </section>
        </>
    )
}

function Stat({ icon: Icon, label, value, detail, tone, delay }: {
    icon: typeof MapIcon; label: string; value: number; detail: string
    tone: keyof typeof TONES; delay: number
}) {
    const t = TONES[tone]
    return (
        <div className={`zn-in zn-lift rounded-2xl p-5 shadow-sm ${t.card}`} style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${t.icon}`}><Icon size={19} /></div>
            <p className={`mt-5 text-sm ${t.label}`}>{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            <p className={`mt-1 text-xs ${t.label}`}>{detail}</p>
        </div>
    )
}

function ZoneRow({ zone: z, delay, onEdit, onDelete }: {
    zone: Zone
    delay: number
    onEdit: () => void
    onDelete: () => void
}) {
    const hasDay = !!z.collectionDay
    const dayLabel = z.collectionDay ? DAY_LABEL[z.collectionDay] ?? z.collectionDay : 'No day set'

    return (
        <div className="zn-in zn-lift rounded-xl bg-muted/60 p-3" style={{ animationDelay: `${delay}ms` }}>
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                        hasDay ? 'bg-[#173a2e] text-[#d8ed65]' : 'bg-amber-100 text-amber-700'
                    }`}
                >
                    <MapIcon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{z.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                        {z.description || 'No description'}
                    </p>
                </div>

                <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        hasDay ? 'bg-[#e3f1de] text-[#4c8c62]' : 'bg-amber-100 text-amber-700'
                    }`}
                >
                    {hasDay ? <CalendarCheck size={12} /> : <CalendarX size={12} />}
                    {dayLabel}
                </span>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onEdit}
                        aria-label={`Edit ${z.name}`}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-background hover:text-foreground"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={onDelete}
                        aria-label={`Delete ${z.name}`}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof MapIcon; title: string; subtitle: string }) {
    return (
        <div className="w-full rounded-xl bg-muted/60 p-8 text-center">
            <Icon className="mx-auto text-muted-foreground" size={26} />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
    )
}