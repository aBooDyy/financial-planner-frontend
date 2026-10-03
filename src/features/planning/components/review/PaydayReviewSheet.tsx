import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Checkbox } from '#/components/ui/checkbox'
import { NoteBox } from '#/components/dialog/NoteBox'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { CurrencyCode } from '#/lib/currency'
import {
  amountInputProps,
  convertMinor,
  minorToInputValue,
  parseAmountToMinor,
} from '#/lib/currency'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import {
  confirmReview,
  postponeReview,
} from '#/features/planning/actions/confirmReview'
import {
  paydayReview,
  transfersFor,
  waitingReviews,
} from '#/features/planning/data/review'
import type {
  ReviewGroupKey,
  ReviewLine,
} from '#/features/planning/data/review'
import { useMoneyFigures } from '#/features/planning/hooks/useMoneyFigures'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { toast } from '#/features/planning/stores/toast'
import { overCommitText, overCommits } from '#/features/planning/view/addMoney'
import {
  dayMonth,
  money,
  monthYear,
  plural,
} from '#/features/planning/view/format'
import { cn } from '#/lib/utils'
import { MicroLabel } from '#/features/planning/components/kit/MicroLabel'
import { Dot } from '#/features/planning/components/kit/Spine'

const GROUP_TITLE: Record<ReviewGroupKey, string> = {
  bills_before_payday: 'Bills due before next payday',
  saving_up: 'Saving up for bills',
  goals: 'Goals',
}

type Draft = { ticked: boolean; amount: string; walletId: string | null }

type Props = {
  /** The payday to review; null = the oldest waiting one, else the next one. */
  payday: string | null
  onClose: () => void
}

/**
 * The payday review (03 §4, one-sheet variant): every set-aside the paycheck should make —
 * bills due before the next payday, saving up, goals — each editable or untickable, the
 * transfer each other wallet needs, then **Set aside** in one go or **Not now**.
 */
export function PaydayReviewSheet(props: Props) {
  return usePlanningReady() ? <PaydayReviewBody {...props} /> : null
}

function PaydayReviewBody({ payday, onClose }: Props) {
  const { inputs, state, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const { figures } = useMoneyFigures()
  const walletCurrency = useMemo(
    () =>
      new Map<string, CurrencyCode>(
        [...wallets.byId.values()].map((w) => [w.id, w.currency]),
      ),
    [wallets.byId],
  )
  const [review] = useState(() => {
    const options = { today, walletCurrency }
    const day =
      payday ??
      waitingReviews(inputs, state, options).at(0)?.payday ??
      state.funding.slots.at(0)?.date ??
      today
    return paydayReview(inputs, state, day, options)
  })
  const lines = review.groups.flatMap((g) => g.lines)
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.plannedId,
        {
          ticked: true,
          amount: minorToInputValue(l.amount, l.currency),
          walletId: l.walletId,
        },
      ]),
    ),
  )
  const [moved, setMoved] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const deposit = review.depositWalletId
  const depositCurrency =
    (deposit ? walletCurrency.get(deposit) : undefined) ?? inputs.base
  const edited = lines.map((l) => {
    const d = drafts[l.plannedId]
    return {
      line: l,
      ticked: d.ticked,
      walletId: d.walletId,
      amount: parseAmountToMinor(d.amount, l.currency) ?? 0,
      currency: l.currency,
    }
  })
  const ticked = edited.filter((e) => e.ticked && e.amount > 0)
  const total = ticked.reduce(
    (sum, e) =>
      sum + convertMinor(e.amount, e.currency, inputs.base, inputs.rates),
    0,
  )
  const transfers = transfersFor(edited, deposit, depositCurrency, inputs.rates)
  const isMoved = (to: string) => moved[to] ?? true

  // Free money after the ticked transfers land, for the guardrail.
  const free = new Map(
    Object.values(figures.wallets).map((w) => [
      w.walletId,
      { free: w.free, currency: w.currency },
    ]),
  )
  for (const t of transfers) {
    if (!isMoved(t.toWalletId) || !deposit) continue
    const to = free.get(t.toWalletId)
    const from = free.get(deposit)
    if (to)
      to.free += convertMinor(
        t.amount,
        depositCurrency,
        to.currency,
        inputs.rates,
      )
    if (from)
      from.free -= convertMinor(
        t.amount,
        depositCurrency,
        from.currency,
        inputs.rates,
      )
  }
  const over = overCommits(
    ticked.flatMap((e) =>
      e.walletId
        ? [
            {
              walletId: e.walletId,
              amount: convertMinor(
                e.amount,
                e.currency,
                inputs.base,
                inputs.rates,
              ),
            },
          ]
        : [],
    ),
    inputs.base,
    free,
    inputs.rates,
  )

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((all) => ({ ...all, [id]: { ...all[id], ...patch } }))

  const submit = async () => {
    setBusy(true)
    try {
      const made = await confirmReview(
        ticked.map((e) => ({
          plannedId: e.line.plannedId,
          amount: e.amount,
          walletId: e.walletId,
        })),
        deposit
          ? transfers
              .filter((t) => isMoved(t.toWalletId))
              .map((t) => {
                const toCurrency =
                  walletCurrency.get(t.toWalletId) ?? depositCurrency
                return {
                  fromWalletId: deposit,
                  toWalletId: t.toWalletId,
                  amount: t.amount,
                  fromCurrency: depositCurrency,
                  toAmount: convertMinor(
                    t.amount,
                    depositCurrency,
                    toCurrency,
                    inputs.rates,
                  ),
                  toCurrency,
                }
              })
          : [],
        { note: `Set aside from the ${dayMonth(review.payday)} paycheck` },
      )
      toast(
        `${money(total, inputs.base)} set aside across ${plural(made, 'item')}`,
      )
      onClose()
    } finally {
      setBusy(false)
    }
  }
  const notNow = async () => {
    setBusy(true)
    try {
      await postponeReview(
        lines.filter((l) => l.waiting).map((l) => l.plannedId),
      )
      toast('Left in Needs confirming')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const subOf = (l: ReviewLine) =>
    l.kind === 'bill'
      ? l.dueDate
        ? `Due ${dayMonth(l.dueDate)}`
        : 'Bill'
      : l.dueDate
        ? `By ${monthYear(l.dueDate)}`
        : 'Goal'

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title={`Set aside from your ${dayMonth(review.payday)} paycheck`}
      description="Check the amounts, then set them aside in one go."
      contentClassName="sm:max-w-[640px]"
      footer={
        lines.length === 0 ? (
          <Button
            type="button"
            size="dialog"
            className="w-full"
            onClick={onClose}
          >
            Done
          </Button>
        ) : (
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="quiet"
              size="dialog"
              disabled={busy}
              onClick={() => void notNow()}
              className="flex-1"
            >
              Not now
            </Button>
            <Button
              type="button"
              size="dialog"
              disabled={busy || ticked.length === 0}
              onClick={() => void submit()}
              className="flex-[2]"
            >
              {over.length > 0
                ? 'Set aside anyway'
                : `Set aside ${money(total, inputs.base)}`}
            </Button>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <p className="py-4 text-center text-[13.5px] text-fp-text-2">
          Nothing left to set aside from this paycheck.
        </p>
      ) : null}
      {review.groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <MicroLabel>{GROUP_TITLE[g.key]}</MicroLabel>
            <span className="fp-sensitive text-[12px] font-bold text-fp-text-2 tabular-nums">
              {money(g.total, inputs.base)}
            </span>
          </div>
          <ul className="overflow-hidden rounded-[14px] border border-fp-border">
            {g.lines.map((l) => {
              const d = drafts[l.plannedId]
              return (
                <li
                  key={l.plannedId}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-fp-border px-3 py-[10px] first:border-t-0',
                    !d.ticked && 'opacity-50',
                  )}
                >
                  <Checkbox
                    checked={d.ticked}
                    aria-label={`Set aside for ${l.name}`}
                    onCheckedChange={(v) =>
                      setDraft(l.plannedId, { ticked: v === true })
                    }
                  />
                  <span className="min-w-[120px] flex-1">
                    <span className="block truncate text-[13.5px] font-bold">
                      {l.name}
                    </span>
                    <span className="block text-[11.5px] text-fp-text-3">
                      {subOf(l)}
                    </span>
                  </span>
                  <Select
                    value={d.walletId ?? undefined}
                    onValueChange={(walletId) =>
                      setDraft(l.plannedId, { walletId })
                    }
                  >
                    <SelectTrigger
                      aria-label={`Wallet for ${l.name}`}
                      className="h-auto w-[150px] rounded-full py-[6px] text-[12.5px]"
                    >
                      <SelectValue placeholder="Pick a wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.list.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          <Dot color={w.color} />
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex w-[110px] items-center gap-1 rounded-[11px] border border-fp-border bg-fp-surface-2 px-2 py-[6px] focus-within:border-fp-accent">
                    <span className="text-[11px] font-bold text-fp-text-3">
                      {l.currency}
                    </span>
                    <input
                      aria-label={`Amount for ${l.name}`}
                      {...amountInputProps(l.currency, d.amount, (amount) =>
                        setDraft(l.plannedId, { amount }),
                      )}
                      className="min-w-0 flex-1 border-none bg-transparent text-end text-[13px] font-bold tabular-nums outline-none"
                    />
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {deposit
        ? transfers.map((t) => {
            const to =
              wallets.byId.get(t.toWalletId)?.name ?? 'the other wallet'
            const from = wallets.byId.get(deposit)?.name ?? 'your pay wallet'
            return (
              <label
                key={t.toWalletId}
                className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-fp-border px-[14px] py-3"
              >
                <Checkbox
                  checked={isMoved(t.toWalletId)}
                  onCheckedChange={(v) =>
                    setMoved((all) => ({ ...all, [t.toWalletId]: v === true }))
                  }
                />
                <span>
                  <span className="block text-[13.5px] font-bold">
                    I’ve moved {money(t.amount, depositCurrency)} to {to}
                  </span>
                  <span className="block text-[12px] text-fp-text-2">
                    We’ll record it as a transfer from {from}.
                  </span>
                </span>
              </label>
            )
          })
        : null}
      {over.map((o) => (
        <NoteBox key={o.walletId} tone="danger" icon={<TriangleAlert />}>
          {overCommitText(
            o,
            wallets.byId.get(o.walletId)?.name ?? 'This wallet',
          )}
        </NoteBox>
      ))}
    </ResponsiveDialog>
  )
}
