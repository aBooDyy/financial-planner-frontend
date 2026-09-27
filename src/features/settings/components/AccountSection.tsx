import { useState } from 'react'
import { OfflineNotice } from '#/components/OfflineNotice'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { useProfile } from '#/features/settings/hooks/useProfile'
import { useOnline } from '#/hooks/useOnline'
import { useSessionStore } from '#/stores/session'
import { SectionHeader } from './SectionHeader'

const CARD = 'rounded-2xl border border-fp-border bg-fp-surface shadow-fp'
const FIELD =
  'rounded-[11px] border-fp-border-strong px-3 py-[11px] text-[14px] focus:shadow-[0_0_0_3px_var(--fp-accent-soft)]'

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '·'

export function AccountSection() {
  const user = useSessionStore((s) => s.user)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const { save, saving, error, saved } = useProfile()
  const online = useOnline()

  if (!user) return null

  const memberSince = (() => {
    const d = new Date(user.createdAt)
    return Number.isNaN(d.getTime()) ? null : d.getFullYear()
  })()
  const dirty = name.trim() !== user.name || email.trim() !== user.email
  const canSave =
    online && dirty && name.trim() !== '' && email.trim() !== '' && !saving

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Account"
        subtitle="Your profile and how Means identifies you."
      />

      {/* Profile summary. The avatar is the user's initials — no photo to manage. */}
      <div className={`${CARD} flex flex-wrap items-center gap-4 p-5`}>
        <div className="flex h-15 w-15 shrink-0 items-center justify-center rounded-full bg-fp-accent-soft text-[22px] font-bold text-fp-accent-ink">
          {initialsOf(user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-extrabold tracking-[-0.01em]">
            {user.name}
          </div>
          <div className="mt-0.5 text-[13px] text-fp-text-3">
            {user.email}
            {memberSince ? ` · Member since ${memberSince}` : ''}
          </div>
        </div>
      </div>

      {/* Editable identity. */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="border-b border-fp-border px-[18px] py-4">
          <Label
            htmlFor="account-name"
            className="mb-1.5 block text-[12px] font-semibold text-fp-text-2"
          >
            Full name
          </Label>
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="border-b border-fp-border px-[18px] py-4">
          <Label
            htmlFor="account-email"
            className="mb-1.5 block text-[12px] font-semibold text-fp-text-2"
          >
            Email
          </Label>
          <Input
            id="account-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className={FIELD}
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-[18px] py-[14px]">
          {!online ? (
            <OfflineNotice className="me-auto">
              Profile changes need a connection.
            </OfflineNotice>
          ) : error ? (
            <span className="me-auto text-[13px] text-fp-danger">{error}</span>
          ) : null}
          {saved && !dirty ? (
            <span className="me-auto text-[13px] text-fp-accent-ink">
              Saved
            </span>
          ) : null}
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => void save(name.trim(), email.trim())}
            className="rounded-[11px] bg-fp-accent px-[18px] py-2.5 text-[14px] font-bold text-white shadow-[0_4px_12px_-4px_var(--fp-accent)] hover:brightness-105 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
