'use client'

import { useEffect, useRef, useState } from 'react'
import {
    UserCog, Plus, Pencil, Trash2, X, Loader2, Save, Search, Mail, Lock, Eye, EyeOff,
    User as UserIcon, ShieldCheck, Shield, Users as UsersIcon, UserPlus, AlertCircle,
    ChevronDown, Check,
} from 'lucide-react'

// const API_URL = 'http://localhost:9123'
const API_URL = 'https://notification-system-tman.onrender.com'

type Role = 'ADMIN' | 'STAFF'
type Filter = 'ALL' | Role

type User = {
    id: number
    name: string
    email: string
    role: Role
    createdAt: string
    updatedAt: string
    // password is intentionally absent: the backend never sends it back
}

const ROLE_STYLES = {
    ADMIN: { label: 'Admin', icon: ShieldCheck, pill: 'bg-[#173a2e] text-[#d8ed65]', avatar: 'bg-[#173a2e] text-[#d8ed65]' },
    STAFF: { label: 'Staff', icon: Shield, pill: 'bg-[#e3f1de] text-[#4c8c62]', avatar: 'bg-[#e3f1de] text-[#4c8c62]' },
} as const

// Options for the custom role dropdown
const ROLE_OPTIONS: { value: Role; label: string; dot: string }[] = [
    { value: 'STAFF', label: 'Staff', dot: 'bg-[#4c8c62]' },
    { value: 'ADMIN', label: 'Admin', dot: 'bg-[#f5ad62]' },
]

// Same palette tokens as the other tabs
const TONES = {
    light:  { card: 'bg-card border', icon: 'bg-[#e3f1de] text-[#4c8c62]', label: 'text-muted-foreground' },
    dark:   { card: 'bg-[#173a2e] text-white', icon: 'bg-[#d8ed65] text-[#173a2e]', label: 'text-[#b6cbbd]' },
    lime:   { card: 'bg-[#d8ed65] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#d8ed65]', label: 'text-[#3c5b40]' },
    orange: { card: 'bg-[#f5ad62] text-[#173a2e]', icon: 'bg-[#173a2e] text-[#f5ad62]', label: 'text-[#5a3a14]' },
} as const

const ANIMATIONS = `
@keyframes us-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.us-in   { animation: us-fade-up .5s cubic-bezier(.2,.7,.2,1) backwards; }
.us-lift { transition: transform .25s ease, box-shadow .25s ease; }
.us-lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(23,58,46,.35); }
@media (prefers-reduced-motion: reduce) {
  .us-in { animation: none !important; }
  .us-lift { transition: none; }
}
`

function initials(name: string) {
    return name.trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?'
}

// role and email come from page.tsx, which gets them from /api/auth/me.
// That is the same source the sidebar uses, so this page can never disagree with it.
export default function Users({ role: loggedInRole, email: loggedInEmail, onNameChange }: {
    role: 'admin' | 'staff'
    email: string
    onNameChange?: (name: string) => void
}) {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [formError, setFormError] = useState('')

    const [filter, setFilter] = useState<Filter>('ALL')
    const [query, setQuery] = useState('')

    const [showForm, setShowForm] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [role, setRole] = useState<Role>('STAFF')

    const isAdmin = loggedInRole === 'admin'
    const sameEmail = (a?: string, b?: string) =>
        !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
    const isMe = (u: { email: string }) => sameEmail(u.email, loggedInEmail)
    const canEdit = (u: User) => isAdmin || isMe(u)
    const canDelete = (u: User) => isAdmin && !isMe(u)

    useEffect(() => {
        fetchUsers()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loggedInRole, loggedInEmail])

    async function fetchUsers() {
        setLoading(true)
        setError('')
        try {
            // Admins see everyone, staff only see themselves
            const url = isAdmin ? `${API_URL}/users` : `${API_URL}/users/me`
            const res = await fetch(url, { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch users')
            const data = await res.json()

            if (isAdmin) {
                setUsers(data)
            } else if (isMe(data)) {
                setUsers([data])
            } else {
                // Never show another account to a staff member
                console.error('/users/me returned a different account than /api/auth/me:', data?.email, loggedInEmail)
                setUsers([])
                setError('Could not load your profile. Please sign out and sign in again.')
            }
        } catch (err) {
            console.error(err)
            setError('Could not load users. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    function resetForm() {
        setName('')
        setEmail('')
        setPassword('')
        setShowPassword(false)
        setRole('STAFF')
        setEditingUser(null)
        setFormError('')
        setShowForm(false)
    }

    function startEdit(user: User) {
        setEditingUser(user)
        setName(user.name)
        setEmail(user.email)
        setPassword('') // never prefilled
        setShowPassword(false)
        setRole(user.role)
        setFormError('')
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setFormError('')

        // Role is only ever sent when creating a user, and the backend ignores it on update.
        const payload: Record<string, unknown> = { name }
        if (!editingUser) {
            payload.email = email
            payload.role = role
            payload.password = password
        } else {
            if (isAdmin) payload.email = email
            if (password.trim() !== '') payload.password = password
        }

        try {
            const url = editingUser ? `${API_URL}/users/${editingUser.id}` : `${API_URL}/users`
            const method = editingUser ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const text = await res.text()
                console.error('Save user failed:', res.status, text)
                setFormError(
                    res.status === 409
                        ? 'That email address is already in use.'
                        : 'Could not save changes. Please try again.'
                )
                return
            }

            // Keep the sidebar and header name in sync when someone edits their own profile
            if (editingUser && isMe(editingUser)) onNameChange?.(name)

            await fetchUsers()
            resetForm()
        } catch (err) {
            console.error(err)
            setFormError('Could not save changes. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this user?')) return
        setError('')
        try {
            const res = await fetch(`${API_URL}/users/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!res.ok) throw new Error('Failed to delete user')
            setUsers((prev) => prev.filter((u) => u.id !== id))
        } catch (err) {
            console.error(err)
            setError('Could not delete the user. Please try again.')
        }
    }

    // ---- derived data ----
    const adminCount = users.filter((u) => u.role === 'ADMIN').length
    const staffCount = users.filter((u) => u.role === 'STAFF').length
    const now = new Date()
    const joinedThisMonth = users.filter((u) => {
        const d = new Date(u.createdAt)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length

    const filters: { key: Filter; label: string; count: number }[] = [
        { key: 'ALL', label: 'All', count: users.length },
        { key: 'ADMIN', label: 'Admins', count: adminCount },
        { key: 'STAFF', label: 'Staff', count: staffCount },
    ]

    const q = query.trim().toLowerCase()
    const visible = users
        .filter((u) => filter === 'ALL' || u.role === filter)
        .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name))

    // Staff can't change their own email; admins can change others' emails.
    // Editing your own email is blocked for everyone, because your login token is tied to it.
    const emailLocked = !!editingUser && (!isAdmin || isMe(editingUser))

    const inputCls =
        'mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-[#6b9d72] disabled:opacity-60'

    return (
        <>
            <style>{ANIMATIONS}</style>

            {/* Header banner */}
            <section className="us-in relative mb-6 overflow-hidden rounded-3xl bg-[#173a2e] p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-16 size-56 rounded-full bg-[#d8ed65]/15 blur-2xl" />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#f5ad62]/15 blur-2xl" />
                <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d8ed65] text-[#173a2e]">
                            <UserCog size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                {isAdmin ? 'Users' : 'My profile'}
                            </h2>
                            <p className="mt-1 text-sm text-[#c1d2c7]">
                                {isAdmin
                                    ? `${users.length} ${users.length === 1 ? 'account' : 'accounts'}: ${adminCount} admin${adminCount === 1 ? '' : 's'}, ${staffCount} staff`
                                    : 'Update your name and password.'}
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
                            <Plus size={16} /> New user
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

            {/* Stat cards: admins only, staff just see their own profile */}
            {isAdmin && (
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Stat tone="light" icon={UsersIcon} label="Total users" value={users.length} detail="All accounts" delay={0} />
                    <Stat tone="dark" icon={ShieldCheck} label="Admins" value={adminCount} detail="Full system access" delay={70} />
                    <Stat tone="orange" icon={Shield} label="Staff" value={staffCount} detail="Collection teams" delay={140} />
                    <Stat tone="lime" icon={UserPlus} label="Joined this month" value={joinedThisMonth} detail="New accounts" delay={210} />
                </section>
            )}

            {/* Create / edit form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="us-in mt-6 rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-[#e3f1de] text-[#4c8c62]">
                                {editingUser ? <Pencil size={18} /> : <Plus size={18} />}
                            </div>
                            <div>
                                <h3 className="font-semibold">{editingUser ? 'Edit user' : 'New user'}</h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {editingUser ? `Updating ${editingUser.name}` : 'Create an account and choose a role'}
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
                            <span className="flex items-center gap-2"><UserIcon size={15} className="text-[#4c8c62]" />Full name</span>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
                        </label>
                        <label className="text-sm font-medium">
                            <span className="flex items-center gap-2"><Mail size={15} className="text-[#4c8c62]" />Email address</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={emailLocked}
                                className={inputCls}
                            />
                            {emailLocked && (
                                <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                                    {isAdmin ? 'You can’t change your own email because your login is tied to it.' : 'Only an admin can change email addresses.'}
                                </span>
                            )}
                        </label>

                        <label className="text-sm font-medium sm:col-span-2">
                            <span className="flex items-center gap-2">
                                <Lock size={15} className="text-[#4c8c62]" />
                                {editingUser ? 'New password' : 'Password'}
                                {editingUser && <span className="text-xs font-normal text-muted-foreground">(leave blank to keep current)</span>}
                            </span>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required={!editingUser}
                                    autoComplete="new-password"
                                    className={`${inputCls} pr-11`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    className="absolute right-2 top-1/2 mt-1 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </label>

                        {/* A div (not a label) so clicking the dropdown button doesn't fire twice */}
                        <div className="text-sm font-medium sm:col-span-2">
                            <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#4c8c62]" />Role</span>
                            {editingUser ? (
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <RolePill role={editingUser.role} />
                                    <span className="text-xs font-normal text-muted-foreground">A role can’t be changed after the account is created.</span>
                                </div>
                            ) : (
                                <RoleSelect value={role} onChange={setRole} />
                            )}
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
                            {editingUser ? 'Save changes' : 'Create user'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <section className={`us-in rounded-2xl border bg-card p-5 shadow-sm ${isAdmin ? 'mt-6' : ''}`} style={{ animationDelay: '200ms' }}>
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                        <h3 className="font-semibold">{isAdmin ? 'All users' : 'Your account'}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {isAdmin ? 'Sorted by name, with role' : 'Only you can see and edit this'}
                        </p>
                    </div>
                    {isAdmin && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 transition focus-within:border-[#6b9d72] sm:w-56">
                                <Search size={15} className="shrink-0 text-muted-foreground" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search name or email"
                                    aria-label="Search users"
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
                    )}
                </div>

                <div className="mt-5 flex flex-col gap-3">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Loading...
                        </div>
                    ) : visible.length === 0 ? (
                        <EmptyState
                            icon={UsersIcon}
                            title={users.length === 0 ? 'No users yet' : 'No users match'}
                            subtitle={
                                users.length === 0
                                    ? 'Use "New user" to create the first account.'
                                    : 'Try a different search or filter.'
                            }
                        />
                    ) : (
                        visible.map((u, i) => (
                            <UserRow
                                key={u.id}
                                user={u}
                                isYou={isMe(u)}
                                delay={Math.min(i, 8) * 50}
                                canEdit={canEdit(u)}
                                canDelete={canDelete(u)}
                                onEdit={() => startEdit(u)}
                                onDelete={() => handleDelete(u.id)}
                            />
                        ))
                    )}
                </div>
            </section>
        </>
    )
}

// Custom dropdown that follows the app theme (the native <select> list ignores it)
function RoleSelect({ value, onChange }: { value: Role; onChange: (v: Role) => void }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const current = ROLE_OPTIONS.find((o) => o.value === value) ?? ROLE_OPTIONS[0]

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
                <ShieldCheck size={15} className="shrink-0 text-muted-foreground" />
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
                    {ROLE_OPTIONS.map((o) => {
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
    icon: typeof UsersIcon; label: string; value: number; detail: string
    tone: keyof typeof TONES; delay: number
}) {
    const t = TONES[tone]
    return (
        <div className={`us-in us-lift rounded-2xl p-5 shadow-sm ${t.card}`} style={{ animationDelay: `${delay}ms` }}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${t.icon}`}><Icon size={19} /></div>
            <p className={`mt-5 text-sm ${t.label}`}>{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            <p className={`mt-1 text-xs ${t.label}`}>{detail}</p>
        </div>
    )
}

function RolePill({ role }: { role: Role }) {
    const r = ROLE_STYLES[role] ?? ROLE_STYLES.STAFF
    const RoleIcon = r.icon
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${r.pill}`}>
            <RoleIcon size={12} />
            {r.label}
        </span>
    )
}

function UserRow({ user: u, isYou, delay, canEdit, canDelete, onEdit, onDelete }: {
    user: User
    isYou: boolean
    delay: number
    canEdit: boolean
    canDelete: boolean
    onEdit: () => void
    onDelete: () => void
}) {
    const r = ROLE_STYLES[u.role] ?? ROLE_STYLES.STAFF

    return (
        <div className="us-in us-lift rounded-xl bg-muted/60 p-3" style={{ animationDelay: `${delay}ms` }}>
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${r.avatar}`}>
                    {initials(u.name)}
                </div>

                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{u.name}</span>
                        {isYou && (
                            <span className="rounded-full bg-[#f5ad62]/30 px-2 py-0.5 text-[10px] font-semibold text-[#5a3a14] dark:text-[#f5ad62]">You</span>
                        )}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail size={12} className="shrink-0" />
                        <span className="truncate">{u.email}</span>
                    </p>
                </div>

                <RolePill role={u.role} />

                <div className="flex items-center gap-1">
                    {canEdit && (
                        <button
                            onClick={onEdit}
                            aria-label={`Edit ${u.name}`}
                            className="rounded-lg p-2 text-muted-foreground transition hover:bg-background hover:text-foreground"
                        >
                            <Pencil size={16} />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={onDelete}
                            aria-label={`Delete ${u.name}`}
                            className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof UsersIcon; title: string; subtitle: string }) {
    return (
        <div className="w-full rounded-xl bg-muted/60 p-8 text-center">
            <Icon className="mx-auto text-muted-foreground" size={26} />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
    )
}