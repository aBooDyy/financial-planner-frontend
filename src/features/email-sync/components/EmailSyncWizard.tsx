import { ArrowRight, Check, Lock } from 'lucide-react'
import type { EmailProvider } from '#/features/email-sync/api/types'
import type {
  EmailWizard,
  FieldTarget,
} from '#/features/email-sync/hooks/useEmailWizard'
import { Button } from '#/components/ui/button'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'
const GHOST = 'px-[17px] py-[11px] text-[14px] font-semibold text-fp-text-2'
const PRIMARY = 'gap-[7px] px-[19px] py-[11px] text-[14px]'

const PROVIDERS: {
  key: EmailProvider
  name: string
  desc: string
  mark: string
  color: string
}[] = [
  {
    key: 'google',
    name: 'Gmail',
    desc: 'Google Workspace or personal',
    mark: 'G',
    color: '#EA4335',
  },
  {
    key: 'outlook',
    name: 'Outlook',
    desc: 'Microsoft 365 or Hotmail',
    mark: 'O',
    color: '#0F6CBD',
  },
]

const CURRENCY_COLOR = '#3B82F6'
const MERCHANT_COLOR = '#8B5CF6'

type MappedField = {
  key: FieldTarget
  label: string
  color: string
  soft: string
  optional?: boolean
}

/** The three things a rule can learn from one alert. Only amount + currency are required. */
const FIELDS: MappedField[] = [
  {
    key: 'amount',
    label: 'Amount',
    color: 'var(--fp-accent)',
    soft: 'var(--fp-accent-soft)',
  },
  {
    key: 'currency',
    label: 'Currency',
    color: CURRENCY_COLOR,
    soft: 'rgba(59,130,246,0.13)',
  },
  {
    key: 'merchant',
    label: 'Merchant',
    color: MERCHANT_COLOR,
    soft: 'rgba(139,92,246,0.13)',
    optional: true,
  },
]

type LineMapping = {
  amountIndex: number | null
  currencyIndex: number | null
  merchantIndex: number | null
}

const indexFor = (mapping: LineMapping, key: FieldTarget): number | null =>
  key === 'amount'
    ? mapping.amountIndex
    : key === 'currency'
      ? mapping.currencyIndex
      : mapping.merchantIndex

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '@'
}

export function EmailSyncWizard({ wizard }: { wizard: EmailWizard }) {
  const { state, actions, selectedIds, isMapped } = wizard

  if (state.step === 'provider') {
    return (
      <div className={CARD}>
        <div className="p-6">
          <div className="text-[18px] font-extrabold tracking-[-0.01em]">
            Where do your transaction alerts arrive?
          </div>
          <div className="mt-1 text-[13.5px] text-fp-text-2">
            Pick the inbox provider. You'll sign in on the provider's own page.
          </div>
          <div className="mt-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PROVIDERS.map((p) => {
              const sel = state.provider === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => actions.pickProvider(p.key)}
                  className="rounded-[14px] border p-[15px] text-start"
                  style={{
                    background: sel
                      ? 'var(--fp-accent-soft)'
                      : 'var(--fp-surface)',
                    borderColor: sel ? 'var(--fp-accent)' : 'var(--fp-border)',
                    boxShadow: sel ? '0 0 0 3px var(--fp-accent-soft)' : 'none',
                  }}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[17px] font-extrabold text-white"
                      style={{ background: p.color }}
                    >
                      {p.mark}
                    </span>
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full border-2"
                      style={{
                        borderColor: sel
                          ? 'var(--fp-accent)'
                          : 'var(--fp-border-strong)',
                        background: sel ? 'var(--fp-accent)' : 'transparent',
                      }}
                    >
                      {sel ? (
                        <span className="h-[9px] w-[9px] rounded-full bg-white" />
                      ) : null}
                    </span>
                  </span>
                  <span className="mt-[13px] block text-[15px] font-bold">
                    {p.name}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-fp-text-3">
                    {p.desc}
                  </span>
                </button>
              )
            })}
          </div>
          {state.error ? (
            <div className="mt-3 text-[12.5px] font-semibold text-fp-danger">
              {state.error}
            </div>
          ) : null}
          <div className="mt-6 flex justify-between gap-[10px]">
            <Button
              type="button"
              variant="outline"
              onClick={actions.cancel}
              className={GHOST}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!state.provider || state.busy}
              onClick={() => void actions.beginConnect()}
              className={PRIMARY}
            >
              {state.busy ? 'Redirecting…' : 'Continue'}
              <ArrowRight size={17} strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (state.step === 'connecting') {
    return (
      <div className={CARD}>
        <div className="flex flex-col items-center justify-center px-3 py-12 text-center">
          <div className="h-[46px] w-[46px] animate-spin rounded-full border-4 border-fp-border border-t-fp-accent" />
          <div className="mt-5 text-[16px] font-bold">Loading your inbox…</div>
          <div className="mt-1.5 text-[13px] text-fp-text-3">
            Reading your latest emails (read-only).
          </div>
        </div>
      </div>
    )
  }

  if (state.step === 'select') {
    const selectedCount = selectedIds.length
    const suggestedCount = state.messages.filter((m) => m.likely).length
    return (
      <div className={CARD}>
        <div className="p-6">
          <div className="text-[18px] font-extrabold tracking-[-0.01em]">
            Which emails are transaction alerts?
          </div>
          <div className="mt-1 text-[13.5px] text-fp-text-2">
            Tick every email from your bank or card that reports a transaction —
            Means learns the pattern from your picks.
          </div>
          <div className="my-3 flex flex-wrap items-center gap-[10px]">
            <Button
              type="button"
              variant="outline"
              onClick={actions.selectSuggested}
              className="gap-[7px] rounded-[11px] border-fp-accent bg-fp-accent-soft px-[13px] py-[9px] text-[13px] font-bold text-fp-accent-ink hover:border-fp-accent hover:bg-fp-accent-soft"
            >
              <Check size={14} strokeWidth={2} />
              Select {suggestedCount} suggested
            </Button>
            <span className="text-[13px] font-semibold text-fp-text-2">
              {selectedCount} selected
            </span>
            {selectedCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={actions.clearSelection}
                className="h-auto px-0 py-0 text-[12.5px] font-semibold text-fp-text-3 hover:bg-transparent"
              >
                Clear
              </Button>
            ) : null}
          </div>
          {state.error ? (
            <div className="mb-2 text-[12.5px] font-semibold text-fp-danger">
              {state.error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-[14px] border border-fp-border">
            <div className="max-h-[340px] overflow-auto">
              {state.messages.map((m) => {
                const checked = !!state.selected[m.id]
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => actions.toggleSelect(m.id)}
                    className="flex w-full items-start gap-3 border-b border-fp-border px-[14px] py-3 text-start last:border-b-0 hover:bg-fp-surface-2"
                    style={{
                      background: checked ? 'var(--fp-accent-soft)' : undefined,
                    }}
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2"
                      style={{
                        borderColor: checked
                          ? 'var(--fp-accent)'
                          : 'var(--fp-border-strong)',
                        background: checked
                          ? 'var(--fp-accent)'
                          : 'transparent',
                      }}
                    >
                      {checked ? (
                        <Check size={12} strokeWidth={3} color="#fff" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-bold">
                          {m.senderName ?? m.senderEmail}
                        </span>
                        {m.likely ? (
                          <span className="shrink-0 rounded-full bg-fp-accent-soft px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-wide text-fp-accent-ink">
                            Likely
                          </span>
                        ) : null}
                        <span className="ms-auto shrink-0 text-[11.5px] text-fp-text-3">
                          {m.date ?? ''}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] font-medium text-fp-text">
                        {m.subject}
                      </span>
                      <span className="mt-px block truncate text-[12px] text-fp-text-3">
                        {m.preview}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-5 flex justify-between gap-[10px]">
            <Button
              type="button"
              variant="outline"
              onClick={actions.cancel}
              className={GHOST}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={selectedCount === 0}
              onClick={actions.goToMap}
              className={PRIMARY}
            >
              {selectedCount > 0
                ? `Map ${selectedCount} email${selectedCount > 1 ? 's' : ''}`
                : 'Select at least one'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // step === 'map'
  const ids = selectedIds
  const mappedCount = ids.filter(isMapped).length
  const curId = ids[state.mapIndex]
  const curMsg = state.messages.find((m) => m.id === curId)
  const mapping = curId ? state.mappings[curId] : undefined
  const allMapped = ids.length > 0 && ids.every(isMapped)

  return (
    <div className={CARD}>
      <div className="p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-extrabold tracking-[-0.01em]">
              Confirm what to pull from each alert
            </div>
            <div className="mt-1 text-[13.5px] text-fp-text-2">
              Tap the line holding the{' '}
              <b className="text-fp-accent-ink">amount</b>, then the line
              holding the <b style={{ color: CURRENCY_COLOR }}>currency</b>.
              Optionally tap the line naming the{' '}
              <b style={{ color: MERCHANT_COLOR }}>merchant</b> — that's who you
              paid, and Means remembers how you categorize them.
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-fp-border bg-fp-surface-2 px-[11px] py-1.5 text-[12.5px] font-bold text-fp-text-2">
            {mappedCount} / {ids.length} ready
          </span>
        </div>

        <div className="mt-[14px] grid grid-cols-1 gap-[18px] md:grid-cols-[200px_minmax(0,1fr)]">
          {/* email switcher */}
          <div className="flex flex-row gap-2 overflow-x-auto md:flex-col md:gap-1 md:overflow-visible">
            {ids.map((id, i) => {
              const m = state.messages.find((x) => x.id === id)
              if (!m) return null
              const active = i === state.mapIndex
              const ready = isMapped(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => actions.setMapIndex(i)}
                  className="flex shrink-0 items-center gap-[9px] rounded-[11px] border px-[11px] py-[10px] text-start md:w-full"
                  style={{
                    borderColor: active ? 'var(--fp-accent)' : 'transparent',
                    background: active
                      ? 'var(--fp-accent-soft)'
                      : 'transparent',
                  }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-fp-accent-soft text-[11px] font-bold text-fp-accent-ink">
                    {initials(m.senderName ?? m.senderEmail)}
                  </span>
                  <span className="hidden min-w-0 flex-1 md:block">
                    <span className="block truncate text-[12.5px] font-bold">
                      {m.senderName ?? m.senderEmail}
                    </span>
                    <span
                      className="block text-[11px] font-semibold"
                      style={{
                        color: ready
                          ? 'var(--fp-accent-ink)'
                          : 'var(--fp-text-3)',
                      }}
                    >
                      {ready ? 'Ready' : 'Needs setup'}
                    </span>
                  </span>
                  {ready ? (
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-fp-accent">
                      <Check size={11} strokeWidth={3.2} color="#fff" />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* detail */}
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-[9px]">
              {FIELDS.map((field) => {
                const active = state.target === field.key
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => actions.setTarget(field.key)}
                    className="inline-flex items-center gap-[7px] rounded-[11px] border px-[13px] py-[9px] text-[13px] font-bold"
                    style={{
                      borderColor: active ? field.color : 'var(--fp-border)',
                      background: active ? field.soft : 'var(--fp-surface)',
                      color: active ? field.color : 'var(--fp-text-2)',
                    }}
                  >
                    <span
                      className="h-[9px] w-[9px] rounded-[3px]"
                      style={{ background: field.color }}
                    />
                    {field.label}
                    {field.optional ? (
                      <span className="font-semibold text-fp-text-3">
                        optional
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className="overflow-hidden rounded-[14px] border border-fp-border bg-fp-surface-2">
              {curMsg ? (
                <>
                  <div className="border-b border-fp-border bg-fp-surface px-[15px] py-[13px]">
                    <div className="truncate text-[13.5px] font-bold">
                      {curMsg.senderName ?? curMsg.senderEmail}
                    </div>
                    <div className="truncate text-[12px] text-fp-text-3">
                      {curMsg.subject}
                    </div>
                  </div>
                  <div className="p-[10px]">
                    {curMsg.bodyLines.map((line, i) => {
                      const marks = mapping
                        ? FIELDS.filter((f) => indexFor(mapping, f.key) === i)
                        : []
                      const bg =
                        marks.length === 0
                          ? 'transparent'
                          : marks.length === 1
                            ? marks[0].soft
                            : `linear-gradient(90deg,${marks.map((m) => m.soft).join(',')})`
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => actions.assignLine(i)}
                          className="mb-0.5 flex w-full items-center gap-2 rounded-[9px] border-s-[3px] px-[11px] py-[9px] text-start font-mono text-[13px] text-fp-text"
                          style={{
                            background: bg,
                            borderInlineStartColor:
                              marks[0]?.color ?? 'transparent',
                          }}
                        >
                          <span className="min-w-0 flex-1 whitespace-pre-wrap">
                            {line}
                          </span>
                          {marks.map((m) => (
                            <span
                              key={m.key}
                              className="shrink-0 rounded-full px-[7px] py-0.5 text-[10px] font-bold text-white"
                              style={{ background: m.color }}
                            >
                              {m.label}
                            </span>
                          ))}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {state.error ? (
          <div className="mt-3 text-[12.5px] font-semibold text-fp-danger">
            {state.error}
          </div>
        ) : null}
        <div className="mt-5 flex justify-between gap-[10px]">
          <Button
            type="button"
            variant="outline"
            onClick={actions.backToSelect}
            className={GHOST}
          >
            Back
          </Button>
          <Button
            type="button"
            disabled={!allMapped || state.busy}
            onClick={() => void actions.finish()}
            className={PRIMARY}
          >
            <Lock size={15} strokeWidth={2} />
            {state.busy
              ? 'Saving…'
              : allMapped
                ? 'Finish setup'
                : `${mappedCount} of ${ids.length} mapped`}
          </Button>
        </div>
      </div>
    </div>
  )
}
