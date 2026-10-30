import { useState } from 'react'
import type { ReactNode } from 'react'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { Button } from '#/components/ui/button'
import type { HeldLine } from '#/features/planning/data/status'
import type { PlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { cycleDate } from '#/features/planning/view/billCycles'
import { dayMonth, money } from '#/features/planning/view/format'
import { HISTORY_SHOWN } from '#/features/planning/view/history'
import type { HistoryLine } from '#/features/planning/view/history'
import type { Chip } from '#/features/planning/view/itemCopy'
import { cn } from '#/lib/utils'
import { MicroLabel } from '#/features/planning/components/kit/MicroLabel'
import { ProgressBar } from '#/features/planning/components/kit/ProgressBar'
import { Dot } from '#/features/planning/components/kit/Spine'
import { StatusChip } from '#/features/planning/components/kit/StatusChip'

/** The panel's lead: what it is about, how far along, and its state. */
export function DetailHero({
  label,
  value,
  progress,
  note,
  chip,
}: {
  label: string
  value: string
  progress?: { value: number; max: number; color: string }
  note: string
  chip: Chip
}) {
  return (
    <div className="rounded-[16px] bg-fp-surface-2 px-4 py-[14px]">
      <div className="text-[12.5px] font-bold text-fp-text-2">{label}</div>
      <div className="fp-sensitive mt-1 text-[23px] font-extrabold tracking-[-0.02em] tabular-nums">
        {value}
      </div>
      {progress ? (
        <ProgressBar
          className="mt-[10px] h-2"
          value={progress.value}
          max={progress.max}
          color={progress.color}
        />
      ) : null}
      <div className="mt-[10px] flex items-center justify-between gap-3">
        <span className="fp-sensitive min-w-0 truncate text-[12.5px] text-fp-text-2">
          {note}
        </span>
        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      </div>
    </div>
  )
}

export type DetailAction = {
  label: string
  onClick: () => void
  primary?: boolean
}

/** The panel's three main buttons. */
export function DetailActions({ actions }: { actions: DetailAction[] }) {
  return (
    <div
      className={cn(
        'grid gap-2',
        actions.length >= 3 ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      {actions.map((a) => (
        <Button
          key={a.label}
          type="button"
          variant={a.primary ? 'default' : 'quiet'}
          onClick={a.onClick}
          className="rounded-[12px] px-2 py-[10px] text-[13px] font-bold"
        >
          {a.label}
        </Button>
      ))}
    </div>
  )
}

export function DetailGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <MicroLabel>{title}</MicroLabel>
      {children}
    </section>
  )
}

/** HELD IN: one line per wallet, and what is held outside them. */
export function HeldIn({
  lines,
  currency,
  wallets,
}: {
  lines: ReadonlyArray<HeldLine>
  currency: string
  wallets: PlanningWallets
}) {
  return (
    <DetailGroup title="Held in">
      {lines.length === 0 ? (
        <p className="text-[13px] text-fp-text-3">Nothing set aside yet.</p>
      ) : (
        <ul className="flex flex-col gap-[7px]">
          {lines.map((l, i) => {
            const wallet = l.walletId ? wallets.byId.get(l.walletId) : undefined
            return (
              <li key={i} className="flex items-center gap-[9px] text-[13.5px]">
                <Dot color={wallet?.color ?? 'var(--fp-text-3)'} />
                <span className="min-w-0 flex-1 truncate">
                  {wallet?.name ??
                    (l.walletId
                      ? 'A deleted wallet'
                      : (l.externalLabel ?? 'Held outside'))}
                </span>
                <span className="fp-sensitive font-bold tabular-nums">
                  {money(l.amount, currency)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </DetailGroup>
  )
}

const COMING_SHOWN = 6

/** What the panel shows below its main buttons, one view at a time. */
export function DetailTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <PillSwitch
      label="Show"
      options={options}
      value={value}
      onChange={onChange}
    />
  )
}

/** Planned set-asides still to make: each opens the dialog that confirms, moves or skips it. */
export function ComingSetAsides({
  rows,
  currency,
  today,
}: {
  rows: ReadonlyArray<{ id: string; date: string; amount: number }>
  currency: string
  today: string
}) {
  const [shown, setShown] = useState(COMING_SHOWN)
  const openSheet = usePlanningUi((s) => s.openSheet)
  if (rows.length === 0) return null
  return (
    <DetailGroup title="Set-asides coming up">
      <ul className="flex flex-col gap-[3px]">
        {rows.slice(0, shown).map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() =>
                openSheet({ kind: 'confirmPlanned', plannedId: r.id })
              }
              className="-mx-[6px] flex w-[calc(100%+12px)] items-center justify-between gap-3 rounded-[8px] px-[6px] py-1 text-start text-[13.5px] hover:bg-fp-surface-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{cycleDate(r.date, today)}</span>
                {r.date <= today ? (
                  <StatusChip tone="warn">Waiting</StatusChip>
                ) : null}
              </span>
              <span className="fp-sensitive flex-none font-bold tabular-nums">
                {money(r.amount, currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {rows.length > shown ? (
        <button
          type="button"
          onClick={() => setShown(shown + COMING_SHOWN)}
          className="self-start text-[12.5px] font-bold text-fp-accent-ink hover:underline"
        >
          Show more
        </button>
      ) : null}
    </DetailGroup>
  )
}

/** HISTORY: set-asides, payments, skips, latest first; each opens where it can be changed. */
export function HistoryList({
  lines,
  today,
}: {
  lines: ReadonlyArray<HistoryLine>
  today: string
}) {
  const [shown, setShown] = useState(HISTORY_SHOWN)
  const openSheet = usePlanningUi((s) => s.openSheet)
  const open = (target: NonNullable<HistoryLine['target']>) =>
    openSheet(
      target.kind === 'setAside'
        ? { kind: 'setAside', id: target.id }
        : { kind: 'payment', transactionId: target.id },
    )
  return (
    <DetailGroup title="History">
      {lines.length === 0 ? (
        <p className="text-[13px] text-fp-text-3">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-[3px]">
          {lines.slice(0, shown).map((l) => {
            const { target } = l
            const body = (
              <>
                <span className="w-[46px] flex-none text-[12px] leading-[1.25] font-bold text-fp-text-3">
                  {dayMonth(l.date)}
                  {l.date.slice(0, 4) !== today.slice(0, 4) ? (
                    <span className="block font-semibold">
                      {l.date.slice(0, 4)}
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{l.label}</span>
                  <span className="block truncate text-[11.5px] text-fp-text-3">
                    {l.occurrence
                      ? `For ${cycleDate(l.occurrence, today)} · ${l.sub}`
                      : l.sub}
                  </span>
                </span>
                <span
                  className={cn(
                    'fp-sensitive flex-none font-bold tabular-nums',
                    l.tone === 'in' && 'text-fp-transfer',
                    l.tone === 'none' && 'text-fp-text-3',
                  )}
                >
                  {l.amount}
                </span>
              </>
            )
            const row =
              '-mx-[6px] flex w-[calc(100%+12px)] items-center gap-3 rounded-[8px] px-[6px] py-[5px] text-start text-[13px]'
            return (
              <li key={l.key}>
                {target ? (
                  <button
                    type="button"
                    onClick={() => open(target)}
                    className={cn(row, 'hover:bg-fp-surface-2')}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {lines.length > shown ? (
        <button
          type="button"
          onClick={() => setShown(shown + HISTORY_SHOWN)}
          className="self-start text-[12.5px] font-bold text-fp-accent-ink hover:underline"
        >
          Show more
        </button>
      ) : null}
    </DetailGroup>
  )
}
