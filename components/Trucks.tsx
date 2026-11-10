'use client'

import { useEffect, useRef, useState } from 'react'
import {
    Truck as TruckIcon, Plus, Pencil, Trash2, X, Loader2, Save, Search, Wrench,
    CheckCircle2, AlertCircle, User as UserIcon, Weight, Tag, CalendarDays, ListChecks, Hash,
    ChevronDown, Check,
} from 'lucide-react'

// const API_URL = 'http://localhost:9123'
const API_URL = 'https://notification-system-tman.onrender.com'

type Status = 'AVAILABLE' | 'IN_SERVICE' | 'MAINTENANCE'
type Filter = 'ALL' | Status

type Truck = {
    id: number
    plateNumber: string
    model: string | null
    capacityTons: number | null
    driverName: string | null
    status: Status
    createdAt: string
    updatedAt: string
}

// Only the fields needed to count upcoming bookings per truck
type ScheduleLite = {
    id: number
    truck?: { id: number } | null
    collectionDate: string
    status: string
}

const STATUS_STYLES = {
    AVAILABLE:   { label: 'Available',   icon: CheckCircle2, pill: 'bg-[#e3f1de] text-[#4c8c62]', box: 'bg-[#173a2e] text-[#d8ed65]' },
    IN_SERVICE:  { label: 'In service',  icon: TruckIcon,    pill: 'bg-blue-100 text-blue-700',   box: 'bg-blue-100 text-blue-700' },
    MAINTENANCE: { label: 'Maintenance', icon: Wrench,       pill: 'bg-amber-100 text-amber-700', box: 'bg-amber-100 text-amber-700' },
} as const

// Options for the custom status dropdown
const STATUS_OPTIONS: { value: Status; label: string; dot: string }[] = [
    { value: 'AVAILABLE',   label: 'Available',                     dot: 'bg-[#4c8c62]' },
    { value: 'IN_SERVICE',  label: 'In service',                    dot: 'bg-blue-500' },
    { value: 'MAINTENANCE', label: "Maintenance (can't be booked)", dot: 'bg-amber-500' },
]

// Same palette tokens as the other tabs
const TONES = {
    light:  { card: 'bg-card border', icon: 'bg-[#e3f1de] text-[#4c8c62]', label: 'text-muted-foreground' },
    dark:   { card: 'bg-[#173a2e] text-white', icon: 'bg-[#d8ed65] text-[#173a2e]', label: 'text-[#b6cbbd]' },
    lime:   { card: 'bg-[#d8ed65] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#d8ed65]', label: 'text-[#3c5b40]' },
    orange: { card: 'bg-[#f5ad62] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#f5ad62]', label: 'text-[#5a3a14]' },
} as const

const ANIMATIONS = `
@keyframes tk-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.tk-in   { animation: tk-fade-up .5s cubic-bezier(.2,.7,.2,1) backwards; }
.tk-lift { transition: transform .25s ease, box-shadow .25s ease; }
.tk-lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(23,58,46,.35); }
@media (prefers-reduced-motion: reduce) {
  .tk-in { animation: none !important; }
  .tk-lift { transition: none; }
}
`

const pad = (n: number) => String(n).padStart(2, '0')

function todayISO() {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Parse YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') is UTC and can show the wrong day)
function formatDate(iso: string) {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return iso
    return new Date(y, m - 1, d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

// The backend sends {"message": "..."} for 400 and 409 responses
async function errorMessage(res: Response, fallback: string) {
    if (res.status === 400 || res.status === 409) {
        try {
            const data = await res.json()
            if (data && typeof data.message === 'string' && data.message) return data.message
        } catch {
            // body was not JSON, use the fallback
        }
    }
    return fallback
}

export default function Trucks({ isAdmin }: { isAdmin: boolean }) {
    const [trucks, setTrucks] = useState<Truck[]>([])
    const [schedules, setSchedules] = useState<ScheduleLite[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [busyId, setBusyId] = useState<number | null>(null)
    const [error, setError] = useState('')
    const [formError, setFormError] = useState('')

    const [filter, setFilter] = useState<Filter>('ALL')
    const [query, setQuery] = useState('')

    const [showForm, setShowForm] = useState(false)
    const [editingTruck, setEditingTruck] = useState<Truck | null>(null)

    const [plateNumber, setPlateNumber] = useState('')
    const [model, setModel] = useState('')
    const [capacity, setCapacity] = useState('')
    const [driverName, setDriverName] = useState('')
    const [status, setStatus] = useState<Status>('AVAILABLE')

    useEffect(() => {
        fetchTrucks()
        fetchSchedules()
    }, [])

    async function fetchTrucks() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_URL}/trucks`, { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch trucks')
            setTrucks(await res.json())
        } catch (err) {
            console.error(err)
            setError('Could not load trucks. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    // Used to warn before a truck with upcoming bookings goes into maintenance.
    // If this fails the page still works, it just can't show the warnings.
    async function fetchSchedules() {
        try {
            const res = await fetch(`${API_URL}/schedules`, { credentials: 'include' })
            if (res.ok) setSchedules(await res.json())
        } catch (err) {
            console.error(err)
        }
    }

    function resetForm() {
        setPlateNumber('')
        setModel('')
        setCapacity('')
        setDriverName('')
        setStatus('AVAILABLE')
        setEditingTruck(null)
        setFormError('')
        setShowForm(false)
    }

    function startEdit(truck: Truck) {
        setEditingTruck(truck)
        setPlateNumber(truck.plateNumber)
        setModel(truck.model ?? '')
        setCapacity(truck.capacityTons === null ? '' : String(truck.capacityTons))
        setDriverName(truck.driverName ?? '')
        setStatus(truck.status)
        setFormError('')
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setFormError('')

        const payload = {
            plateNumber: plateNumber.trim(),
            model: model.trim() || null,
            capacityTons: capacity.trim() === '' ? null : Number(capacity),
            driverName: driverName.trim() || null,
            status,
        }

        try {
            const url = editingTruck ? `${API_URL}/trucks/${editingTruck.id}` : `${API_URL}/trucks`
            const method = editingTruck ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                console.error('Save truck failed:', res.status)
                setFormError(await errorMessage(res, 'Could not save the truck. Please try again.'))
                return
            }

            await fetchTrucks()
            resetForm()
        } catch (err) {
            console.error(err)
            setFormError('Could not save the truck. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    // One-click status change from the list (for example, send a truck to maintenance)
    async function changeStatus(truck: Truck, next: Status) {
        const upcomingCount = upcoming.get(truck.id)?.length ?? 0
        if (
            next === 'MAINTENANCE' &&
            upcomingCount > 0 &&
            !confirm(
                `${truck.plateNumber} has ${upcomingCount} upcoming ${upcomingCount === 1 ? 'schedule' : 'schedules'}. ` +
                'They will keep this truck until you change them. Send it to maintenance anyway?'
            )
        ) {
            return
        }

        setBusyId(truck.id)
        setError('')
        try {
            const res = await fetch(`${API_URL}/trucks/${truck.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plateNumber: truck.plateNumber,
                    model: truck.model,
                    capacityTons: truck.capacityTons,
                    driverName: truck.driverName,
                    status: next,
                }),
            })
            if (!res.ok) throw new Error(await errorMessage(res, 'Could not update the truck. Please try again.'))
            const updated: Truck = await res.json()
            setTrucks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        } catch (err) {
            console.error(err)
            setError(err instanceof Error ? err.message : 'Could not update the truck. Please try again.')
        } finally {
            setBusyId(null)
        }
    }

    async function handleDelete(truck: Truck) {
        if (!confirm(`Delete truck ${truck.plateNumber}?`)) return
        setError('')
        setBusyId(truck.id)
        try {
            const res = await fetch(`${API_URL}/trucks/${truck.id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!res.ok) throw new Error(await errorMessage(res, 'Could not delete the truck. Please try again.'))
            setTrucks((prev) => prev.filter((t) => t.id !== truck.id))
        } catch (err) {
            console.error(err)
            setError(err instanceof Error ? err.message : 'Could not delete the truck. Please try again.')
        } finally {
            setBusyId(null)
        }
    }

    // ---- derived data ----
    // truckId -> sorted dates of schedules that are still ahead (scheduled or in progress)
    const today = todayISO()
    const upcoming = new Map<number, string[]>()
    for (const s of schedules) {
        if (!s.truck || s.collectionDate < today) continue
        if (s.status !== 'SCHEDULED' && s.status !== 'IN_PROGRESS') continue
        const list = upcoming.get(s.truck.id) ?? []
        list.push(s.collectionDate)
        upcoming.set(s.truck.id, list)
    }
    upcoming.forEach((list) => list.sort())
    const upcomingTotal = Array.from(upcoming.values()).reduce((sum, l) => sum + l.length, 0)

    const count = (st: Status) => trucks.filter((t) => t.status === st).length
    const availableCount = count('AVAILABLE')
    const inServiceCount = count('IN_SERVICE')
    const maintenanceCount = count('MAINTENANCE')

    const filters: { key: Filter; label: string; count: number }[] = [
        { key: 'ALL', label: 'All', count: trucks.length },
        { key: 'AVAILABLE', label: 'Available', count: availableCount },
        { key: 'IN_SERVICE', label: 'In service', count: inServiceCount },
        { key: 'MAINTENANCE', label: 'Maintenance', count: maintenanceCount },
    ]

    const q = query.trim().toLowerCase()
    const visible = trucks
        .filter((t) => filter === 'ALL' || t.status === filter)
        .filter(
            (t) =>
                !q ||
                t.plateNumber.toLowerCase().includes(q) ||
                (t.driverName ?? '').toLowerCase().includes(q) ||
                (t.model ?? '').toLowerCase().includes(q)
        )

    // Shown in the form when an edit would put a truck with bookings into maintenance
    const formUpcoming = editingTruck ? upcoming.get(editingTruck.id) ?? [] : []
    const showMaintenanceWarning =
        !!editingTruck && status === 'MAINTENANCE' && editingTruck.status !== 'MAINTENANCE' && formUpcoming.length > 0

    const inputCls =
        'mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-[#6b9d72]'

    return (
        <>
            <style>{ANIMATIONS}</style>

            {/* Header banner */}
            <section className="tk-in relative mb-6 overflow-hidden rounded-3xl bg-[#173a2e] p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#d8ed65]/15 blur-2xl" />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#f5ad62]/15 blur-2xl" />
                <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d8ed65] text-[#173a2e]">
                            <TruckIcon size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Trucks</h2>
                            <p className="mt-1 text-sm text-[#c1d2c7]">
                                {trucks.length === 0
                                    ? isAdmin
                                        ? 'Add the trucks your teams use for collection.'
                                        : 'No trucks have been added yet.'
                                    : `${availableCount} available · ${inServiceCount} in service · ${maintenanceCount} in maintenance${isAdmin ? '' : ' · view only'}`}
                            </p>
                        </div>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => {
                                resetForm()
                                setShowForm(true)
                            }}
                            className="flex w-fit items-center gap-2 rounded-xl bg-[#d8ed65] px-4 py-3 text-sm font-semibold text-[#173a2e] transition hover:brightness-95"
                        >
                            <Plus size={16} /> New truck
                        </button>
                    )}
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
                <Stat tone="light" icon={TruckIcon} label="Total fleet" value={trucks.length} detail={`${upcomingTotal} upcoming ${upcomingTotal === 1 ? 'booking' : 'bookings'}`} delay={0} />
                <Stat tone="lime" icon={CheckCircle2} label="Available" value={availableCount} detail="Ready to be booked" delay={70} />
                <Stat tone="dark" icon={TruckIcon} label="In service" value={inServiceCount} detail="Out collecting" delay={140} />
                <Stat tone="orange" icon={Wrench} label="Maintenance" value={maintenanceCount} detail="Can't be booked" delay={210} />
            </section>

            {/* Create / edit form (admins only) */}
            {isAdmin && showForm && (
                <form onSubmit={handleSubmit} className="tk-in mt-6 rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-[#e3f1de] text-[#4c8c62]">
                                {editingTruck ? <Pencil size={18} /> : <Plus size={18} />}
                            </div>
                            <div>
                                <h3 className="font-semibold">{editingTruck ? 'Edit truck' : 'New truck'}</h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {editingTruck ? `Updating ${editingTruck.plateNumber}` : 'Add a truck to the fleet'}
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
                            <span className="flex items-center gap-2"><Hash size={15} className="text-[#4c8c62]" />Plate number</span>
                            <input
                                type="text"
                                value={plateNumber}
                                onChange={(e) => setPlateNumber(e.target.value)}
                                required
                                maxLength={20}
                                placeholder="KDA 123X"
                                className={inputCls}
                            />
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><Tag size={15} className="text-[#4c8c62]" />Model</span>
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="e.g. Isuzu FRR (optional)"
                                className={inputCls}
                            />
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><Weight size={15} className="text-[#4c8c62]" />Capacity (tons)</span>
                            <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value)}
                                placeholder="e.g. 7.5 (optional)"
                                className={inputCls}
                            />
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><UserIcon size={15} className="text-[#4c8c62]" />Driver</span>
                            <input
                                type="text"
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                                placeholder="Driver's name (optional)"
                                className={inputCls}
                            />
                        </label>

                        {/* A div (not a label) so clicking the dropdown button doesn't fire twice */}
                        <div className="text-sm font-medium sm:col-span-2">
                            <span className="flex items-center gap-2"><ListChecks size={15} className="text-[#4c8c62]" />Status</span>
                            <StatusSelect value={status} onChange={setStatus} />
                        </div>
                    </div>

                    {showMaintenanceWarning && (
                        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>
                                This truck has {formUpcoming.length} upcoming {formUpcoming.length === 1 ? 'schedule' : 'schedules'}
                                {' '}({formUpcoming.slice(0, 3).map(formatDate).join(', ')}{formUpcoming.length > 3 ? ', ...' : ''}).
                                They keep this truck until you edit them, so move them to another truck.
                            </span>
                        </div>
                    )}

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
                            {editingTruck ? 'Save changes' : 'Create truck'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <section className="tk-in mt-6 rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: '200ms' }}>
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                        <h3 className="font-semibold">All trucks</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Sorted by plate number, with status and upcoming bookings</p>
                    </div>
                    <div className="flex flex-col gap-3 xl:items-end">
                        <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 transition focus-within:border-[#6b9d72] sm:w-64">
                            <Search size={15} className="shrink-0 text-muted-foreground" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search plate, driver or model"
                                aria-label="Search trucks"
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
                            Loading trucks...
                        </div>
                    ) : visible.length === 0 ? (
                        <EmptyState
                            icon={TruckIcon}
                            title={trucks.length === 0 ? 'No trucks yet' : 'No trucks match'}
                            subtitle={
                                trucks.length === 0
                                    ? isAdmin ? 'Use "New truck" to add the first one.' : 'An administrator can add trucks.'
                                    : 'Try a different search or filter.'
                            }
                        />
                    ) : (
                        visible.map((t, i) => (
                            <TruckRow
                                key={t.id}
                                truck={t}
                                upcomingDates={upcoming.get(t.id) ?? []}
                                isAdmin={isAdmin}
                                busy={busyId === t.id}
                                delay={Math.min(i, 8) * 50}
                                onEdit={() => startEdit(t)}
                                onDelete={() => handleDelete(t)}
                                onStatus={(next) => changeStatus(t, next)}
                            />
                        ))
                    )}
                </div>
            </section>
        </>
    )
}

// Custom dropdown that follows the app theme (the native <select> list ignores it)
function StatusSelect({ value, onChange }: { value: Status; onChange: (v: Status) => void }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const current = STATUS_OPTIONS.find((o) => o.value === value) ?? STATUS_OPTIONS[0]

    // Close on outside click or Escape
    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div ref={ref} className="relative mt-2">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className={`flex w-full items-center gap-3 rounded-xl border bg-background px-3 py-3 text-left text-sm outline-none transition ${
                    open ? 'border-[#6b9d72]' : 'focus:border-[#6b9d72]'
                }`}
            >
                <ListChecks size={15} className="shrink-0 text-muted-foreground" />
                <span className={`size-2 shrink-0 rounded-full ${current.dot}`} />
                <span className="flex-1 truncate">{current.label}</span>
                <ChevronDown
                    size={16}
                    className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border bg-card p-1 shadow-lg"
                >
                    {STATUS_OPTIONS.map((o) => {
                        const selected = o.value === value
                        return (
                            <li key={o.value} role="option" aria-selected={selected}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(o.value)
                                        setOpen(false)
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition hover:bg-muted"
                                >
                                    <span className={`size-2 shrink-0 rounded-full ${o.dot}`} />
                                    <span className="flex-1">{o.label}</span>
                                    {selected && <Check size={16} className="shrink-0" />}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

function Stat({ icon: Icon, label, value, detail, tone, delay }: {
    icon: typeof TruckIcon; label: string; value: number; detail: string
    tone: keyof typeof TONES; delay: number
}) {
    const t = TONES[tone]
    return (
        <div className={`tk-in tk-lift rounded-2xl p-5 shadow-sm ${t.card}`} style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${t.icon}`}><Icon size={19} /></div>
            <p className={`mt-5 text-sm ${t.label}`}>{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            <p className={`mt-1 text-xs ${t.label}`}>{detail}</p>
        </div>
    )
}

function TruckRow({ truck: t, upcomingDates, isAdmin, busy, delay, onEdit, onDelete, onStatus }: {
    truck: Truck
    upcomingDates: string[]
    isAdmin: boolean
    busy: boolean
    delay: number
    onEdit: () => void
    onDelete: () => void
    onStatus: (next: Status) => void
}) {
    const st = STATUS_STYLES[t.status] ?? STATUS_STYLES.AVAILABLE
    const StatusIcon = st.icon
    const inMaintenance = t.status === 'MAINTENANCE'
    const needsAttention = inMaintenance && upcomingDates.length > 0

    const details = [
        t.model,
        t.capacityTons !== null ? `${t.capacityTons} t` : null,
        t.driverName ?? 'No driver',
    ].filter(Boolean)

    return (
        <div className="tk-in tk-lift rounded-xl bg-muted/60 p-3" style={{ animationDelay: `${delay}ms` }}>
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${st.box}`}>
                    <StatusIcon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.plateNumber}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserIcon size={12} className="shrink-0" />
                        <span className="truncate">{details.join(' · ')}</span>
                    </p>
                    {upcomingDates.length > 0 && (
                        <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${needsAttention ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>
                            <CalendarDays size={11} className="shrink-0" />
                            {upcomingDates.length} upcoming {upcomingDates.length === 1 ? 'schedule' : 'schedules'}
                            {` (next ${formatDate(upcomingDates[0])})`}
                            {needsAttention && ' · needs another truck'}
                        </p>
                    )}
                </div>

                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${st.pill}`}>
                    <StatusIcon size={12} />
                    {st.label}
                </span>

                {isAdmin && (
                    <div className="flex items-center gap-1">
                        {inMaintenance ? (
                            <button
                                disabled={busy}
                                onClick={() => onStatus('AVAILABLE')}
                                title="Back in service: mark as available"
                                aria-label={`Mark ${t.plateNumber} as available`}
                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#39705a] transition hover:bg-[#e3f1de] disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                                <span className="hidden lg:inline">Mark available</span>
                            </button>
                        ) : (
                            <button
                                disabled={busy}
                                onClick={() => onStatus('MAINTENANCE')}
                                title="Send to maintenance (it can't be booked)"
                                aria-label={`Send ${t.plateNumber} to maintenance`}
                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                {busy ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />}
                                <span className="hidden lg:inline">Maintenance</span>
                            </button>
                        )}
                        <button
                            onClick={onEdit}
                            aria-label={`Edit ${t.plateNumber}`}
                            className="rounded-lg p-2 text-muted-foreground transition hover:bg-background hover:text-foreground"
                        >
                            <Pencil size={16} />
                        </button>
                        <button
                            disabled={busy}
                            onClick={onDelete}
                            aria-label={`Delete ${t.plateNumber}`}
                            className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof TruckIcon; title: string; subtitle: string }) {
    return (
        <div className="w-full rounded-xl bg-muted/60 p-8 text-center">
            <Icon className="mx-auto text-muted-foreground" size={26} />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
    )
}