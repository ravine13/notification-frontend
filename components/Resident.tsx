'use client'

import { useEffect, useState } from 'react'
import {
    Users, Plus, Pencil, Trash2, X, Loader2, Save, Search, Phone, Home,
    Map as MapIcon, AlertCircle, UserPlus, MapPinned, UserCheck,
} from 'lucide-react'

// const API_URL = 'http://localhost:9123'
// const API_URL = 'https://notification-system-tman.onrender.com'
const API_URL = 'https://notificationsystem-production-bf454768.up.railway.app'

type Resident = {
    id: number
    name: string
    phoneNumber: string
    address: string | null
    zone: { id: number }
    createdAt: string
    updatedAt: string
}

type Zone = {
    id: number
    name: string
}

// Same palette tokens as Schedules and Zones so every tab feels like one product
const TONES = {
    light:  { card: 'bg-card border', icon: 'bg-[#e3f1de] text-[#4c8c62]', label: 'text-muted-foreground' },
    dark:   { card: 'bg-[#173a2e] text-white', icon: 'bg-[#d8ed65] text-[#173a2e]', label: 'text-[#b6cbbd]' },
    lime:   { card: 'bg-[#d8ed65] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#d8ed65]', label: 'text-[#3c5b40]' },
    orange: { card: 'bg-[#f5ad62] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#f5ad62]', label: 'text-[#5a3a14]' },
} as const

const ANIMATIONS = `
@keyframes rs-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.rs-in   { animation: rs-fade-up .5s cubic-bezier(.2,.7,.2,1) backwards; }
.rs-lift { transition: transform .25s ease, box-shadow .25s ease; }
.rs-lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(23,58,46,.35); }
@media (prefers-reduced-motion: reduce) {
  .rs-in { animation: none !important; }
  .rs-lift { transition: none; }
}
`

function initials(name: string) {
    return name.trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function Residents() {
    const [residents, setResidents] = useState<Resident[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [formError, setFormError] = useState('')

    const [query, setQuery] = useState('')
    const [zoneFilter, setZoneFilter] = useState('ALL')

    const [showForm, setShowForm] = useState(false)
    const [editingResident, setEditingResident] = useState<Resident | null>(null)

    const [name, setName] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [address, setAddress] = useState('')
    const [zoneId, setZoneId] = useState('')

    useEffect(() => {
        fetchResidents()
        fetchZones()
    }, [])

    async function fetchResidents() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_URL}/residents`, { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch residents')
            setResidents(await res.json())
        } catch (err) {
            console.error(err)
            setError('Could not load residents. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    // Zones power the dropdown and let rows show a zone name instead of "Zone #3"
    async function fetchZones() {
        try {
            const res = await fetch(`${API_URL}/zones`, { credentials: 'include' })
            if (res.ok) setZones(await res.json())
        } catch (err) {
            console.error(err)
        }
    }

    function resetForm() {
        setName('')
        setPhoneNumber('')
        setAddress('')
        setZoneId('')
        setEditingResident(null)
        setFormError('')
        setShowForm(false)
    }

    function startEdit(resident: Resident) {
        setEditingResident(resident)
        setName(resident.name)
        setPhoneNumber(resident.phoneNumber)
        setAddress(resident.address ?? '')
        setZoneId(String(resident.zone.id))
        setFormError('')
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setFormError('')

        // zone is a @ManyToOne relation on the backend, so it is sent as a
        // nested object with an id, not as a flat id field.
        const payload = {
            name,
            phoneNumber,
            address: address || null,
            zone: { id: Number(zoneId) },
        }

        try {
            const url = editingResident
                ? `${API_URL}/residents/${editingResident.id}`
                : `${API_URL}/residents`
            const method = editingResident ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const text = await res.text()
                console.error('Save resident failed:', res.status, text)
                setFormError(
                    res.status === 409
                        ? 'A resident with this phone number already exists in this zone.'
                        : 'Could not save the resident. Check the phone number and zone, then try again.'
                )
                return
            }

            await fetchResidents()
            resetForm()
        } catch (err) {
            console.error(err)
            setFormError('Could not save the resident. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this resident?')) return
        setError('')
        try {
            const res = await fetch(`${API_URL}/residents/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!res.ok) throw new Error('Failed to delete resident')
            setResidents((prev) => prev.filter((r) => r.id !== id))
        } catch (err) {
            console.error(err)
            setError('Could not delete the resident. Please try again.')
        }
    }

    // ---- derived data ----
    const zoneName = (id?: number) => {
        if (id === undefined) return 'No zone'
        return zones.find((z) => z.id === id)?.name ?? `Zone #${id}`
    }

    const zonesCovered = new Set(residents.map((r) => r.zone?.id).filter((id) => id !== undefined)).size
    const withAddress = residents.filter((r) => r.address).length
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const newThisWeek = residents.filter((r) => new Date(r.createdAt).getTime() >= weekAgo).length

    const q = query.trim().toLowerCase()
    const visible = residents
        .filter((r) => zoneFilter === 'ALL' || String(r.zone?.id) === zoneFilter)
        .filter(
            (r) =>
                !q ||
                r.name.toLowerCase().includes(q) ||
                r.phoneNumber.toLowerCase().includes(q) ||
                (r.address ?? '').toLowerCase().includes(q)
        )
        .sort((a, b) => a.name.localeCompare(b.name))

    const inputCls =
        'mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-[#6b9d72] disabled:opacity-60'

    return (
        <>
            <style>{ANIMATIONS}</style>

            {/* Header banner */}
            <section className="rs-in relative mb-6 overflow-hidden rounded-3xl bg-[#173a2e] p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#d8ed65]/15 blur-2xl" />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#f5ad62]/15 blur-2xl" />
                <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d8ed65] text-[#173a2e]">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Residents</h2>
                            <p className="mt-1 text-sm text-[#c1d2c7]">
                                {residents.length === 0
                                    ? 'Add the households that receive pickup notifications.'
                                    : `${residents.length} residents across ${zonesCovered} ${zonesCovered === 1 ? 'zone' : 'zones'}`}
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
                        <Plus size={16} /> New resident
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
                <Stat tone="light" icon={Users} label="Total residents" value={residents.length} detail="Registered households" delay={0} />
                <Stat tone="orange" icon={MapPinned} label="Zones covered" value={zonesCovered} detail={`Of ${zones.length} zones`} delay={70} />
                <Stat tone="dark" icon={UserCheck} label="With address" value={withAddress} detail={`${residents.length - withAddress} without one`} delay={140} />
                <Stat tone="lime" icon={UserPlus} label="New this week" value={newThisWeek} detail="Added in the last 7 days" delay={210} />
            </section>

            {/* Create / edit form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="rs-in mt-6 rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-[#e3f1de] text-[#4c8c62]">
                                {editingResident ? <Pencil size={18} /> : <Plus size={18} />}
                            </div>
                            <div>
                                <h3 className="font-semibold">{editingResident ? 'Edit resident' : 'New resident'}</h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {editingResident ? `Updating ${editingResident.name}` : 'Add contact details and choose their zone'}
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
                        <label className="text-sm font-medium sm:col-span-2">
                            <span className="flex items-center gap-2"><Users size={15} className="text-[#4c8c62]" />Full name</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className={inputCls}
                            />
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
                            <span className="flex items-center gap-2"><MapIcon size={15} className="text-[#4c8c62]" />Zone</span>
                            {zones.length > 0 ? (
                                <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} required className={inputCls}>
                                    <option value="">Select a zone</option>
                                    {zones.map((z) => (
                                        <option key={z.id} value={z.id}>{z.name}</option>
                                    ))}
                                </select>
                            ) : (
                                // Fallback if zones fail to load: keep the old numeric entry working
                                <input
                                    type="number"
                                    value={zoneId}
                                    onChange={(e) => setZoneId(e.target.value)}
                                    required
                                    placeholder="Zone ID"
                                    className={inputCls}
                                />
                            )}
                        </label>
                        <label className="text-sm font-medium sm:col-span-2">
                            <span className="flex items-center gap-2"><Home size={15} className="text-[#4c8c62]" />Address</span>
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Estate, street or house number (optional)"
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
                            {editingResident ? 'Save changes' : 'Create resident'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <section className="rs-in mt-6 rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '200ms' }}>
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                        <h3 className="font-semibold">All residents</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Sorted by name, with phone, address and zone</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 transition focus-within:border-[#6b9d72] sm:w-64">
                            <Search size={15} className="shrink-0 text-muted-foreground" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search name, phone or address"
                                aria-label="Search residents"
                                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                            />
                        </label>
                        <select
                            value={zoneFilter}
                            onChange={(e) => setZoneFilter(e.target.value)}
                            aria-label="Filter by zone"
                            className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-[#6b9d72]"
                        >
                            <option value="ALL">All zones</option>
                            {zones.map((z) => (
                                <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Loading residents...
                        </div>
                    ) : visible.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            title={residents.length === 0 ? 'No residents yet' : 'No residents match'}
                            subtitle={
                                residents.length === 0
                                    ? 'Use "New resident" to add the first household.'
                                    : 'Try a different search or zone.'
                            }
                        />
                    ) : (
                        visible.map((r, i) => (
                            <ResidentRow
                                key={r.id}
                                resident={r}
                                zoneLabel={zoneName(r.zone?.id)}
                                delay={Math.min(i, 8) * 50}
                                onEdit={() => startEdit(r)}
                                onDelete={() => handleDelete(r.id)}
                            />
                        ))
                    )}
                </div>
            </section>
        </>
    )
}

function Stat({ icon: Icon, label, value, detail, tone, delay }: {
    icon: typeof Users; label: string; value: number; detail: string
    tone: keyof typeof TONES; delay: number
}) {
    const t = TONES[tone]
    return (
        <div className={`rs-in rs-lift rounded-2xl p-5 shadow-sm ${t.card}`} style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${t.icon}`}><Icon size={19} /></div>
            <p className={`mt-5 text-sm ${t.label}`}>{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            <p className={`mt-1 text-xs ${t.label}`}>{detail}</p>
        </div>
    )
}

function ResidentRow({ resident: r, zoneLabel, delay, onEdit, onDelete }: {
    resident: Resident
    zoneLabel: string
    delay: number
    onEdit: () => void
    onDelete: () => void
}) {
    return (
        <div className="rs-in rs-lift rounded-xl bg-muted/60 p-3" style={{ animationDelay: `${delay}ms` }}>
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#173a2e] text-sm font-bold text-[#d8ed65]">
                    {initials(r.name)}
                </div>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Phone size={12} />{r.phoneNumber}</span>
                        <span className="flex min-w-0 items-center gap-1.5">
                            <Home size={12} className="shrink-0" />
                            <span className="truncate">{r.address || 'No address'}</span>
                        </span>
                    </p>
                </div>

                <span className="flex items-center gap-1.5 rounded-full bg-[#e3f1de] px-2.5 py-1 text-[10px] font-semibold text-[#4c8c62]">
                    <MapIcon size={12} />
                    {zoneLabel}
                </span>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onEdit}
                        aria-label={`Edit ${r.name}`}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-background hover:text-foreground"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={onDelete}
                        aria-label={`Delete ${r.name}`}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof Users; title: string; subtitle: string }) {
    return (
        <div className="w-full rounded-xl bg-muted/60 p-8 text-center">
            <Icon className="mx-auto text-muted-foreground" size={26} />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
    )
}