import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import type { HeldLine } from '#/features/planning/data/status'
import type { PlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { dayMonth, fullDate, money } from '#/features/planning/view/format'
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

/** NEXT 3: a repeating bill's coming occurrences. */
export function NextOccurrences({
  next,
  currency,
}: {
  next: ReadonlyArray<{ occurrence: string; amount: number; setAside: number }>
  currency: string
}) {
  if (next.length === 0) return null
  return (
    <DetailGroup title={`Next ${next.length}`}>
      <ul className="flex flex-col gap-[7px]">
        {next.map((n) => (
          <li
            key={n.occurrence}
            className="flex items-center justify-between gap-3 text-[13.5px]"
          >
            <span>{fullDate(n.occurrence)}</span>
            <span className="fp-sensitive font-bold tabular-nums">
              {money(n.amount, currency)}
              {n.setAside > 0 ? (
                <span className="ms-1 text-[11.5px] font-semibold text-fp-transfer">
                  {money(n.setAside, currency)} set aside
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </DetailGroup>
  )
}

/** HISTORY: set-asides, payments, skips — latest first. */
export function HistoryList({ lines }: { lines: ReadonlyArray<HistoryLine> }) {
  return (
    <DetailGroup title="History">
      {lines.length === 0 ? (
        <p className="text-[13px] text-fp-text-3">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-[9px]">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3 text-[13px]">
              <span className="w-[46px] flex-none text-[12px] font-bold text-fp-text-3">
                {dayMonth(l.date)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{l.label}</span>
                <span className="block truncate text-[11.5px] text-fp-text-3">
                  {l.sub}
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
            </li>
          ))}
        </ul>
      )}
    </DetailGroup>
  )
}
