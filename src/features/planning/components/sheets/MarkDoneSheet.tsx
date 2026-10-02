import { useState } from 'react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { FieldLabel } from '#/components/FieldLabel'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import { closeBill } from '#/features/bills/data/actions'
import { closeGoal } from '#/features/goals/data/actions'
import type { PlanOwner } from '#/features/planned/data/owners'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { markGoalSpent } from '#/features/planning/actions/goalMoney'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanOwner } from '#/features/planning/hooks/usePlanOwner'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { toast } from '#/features/planning/stores/toast'
import { money } from '#/features/planning/view/format'
import type { Leftover } from '#/features/setAsides/data/leftover'
import { cn } from '#/lib/utils'
import { ProgressBar } from '#/features/planning/components/kit/ProgressBar'
import { SpentFrom, useSpentFrom } from './SpentFrom'

type Choice = 'spent' | 'free' | 'move'

type Props = { owner: PlanOwner; onClose: () => void }

/**
 * Mark as done (02, D23, D30): closes a bill or goal whatever its progress, and asks in the same
 * sheet what happens to money still set aside — spent (goals), freed, or moved to another one.
 */
export function MarkDoneSheet(props: Props) {
  return usePlanningReady() ? <MarkDoneSheetBody {...props} /> : null
}

function MarkDoneSheetBody({ owner, onClose }: Props) {
  const info = usePlanOwner(owner)
  const { inputs } = usePlannedData()
  const planning = usePlanning()
  const wallets = usePlanningWallets()
  const isGoal = owner.kind === 'goal'
  const goalStatus = isGoal ? planning.goals[owner.id] : undefined
  const billStatus = isGoal ? undefined : planning.bills[owner.id]
  const held = goalStatus?.setAside ?? billStatus?.setAside ?? 0
  const [choice, setChoice] = useState<Choice>(isGoal ? 'spent' : 'free')
  const [moveTo, setMoveTo] = useState('')
  const spentFrom = useSpentFrom({
    heldIn: goalStatus?.heldIn ?? [],
    held,
    currency: info?.currency ?? wallets.base,
    defaultWalletId:
      goalStatus?.heldIn.find((h) => h.walletId)?.walletId ??
      (info?.kind === 'goal' ? info.goal.saveWalletId : null) ??
      wallets.list.at(0)?.id ??
      '',
  })
  const [categoryId, setCategoryId] = useState<string | null>(
    info?.kind === 'goal' ? info.goal.useCategoryId : null,
  )
  const [busy, setBusy] = useState(false)

  if (!info) return null
  const currency = info.currency
  const oneOff = info.kind === 'bill' && info.bill.frequency === null
  const verb =
    info.kind === 'goal'
      ? 'Mark as done'
      : oneOff
        ? 'Mark as paid'
        : 'End this bill'
  const title =
    info.kind === 'goal'
      ? `Mark ${info.name} as done`
      : oneOff
        ? `Mark ${info.name} as paid`
        : `End ${info.name}`

  const targets = {
    bills: inputs.bills.filter((b) => b.closedAt === null && b.id !== owner.id),
    goals: inputs.goals.filter((g) => g.closedAt === null && g.id !== owner.id),
  }
  const leftover = (): Leftover => {
    if (choice !== 'move' || !moveTo) return { kind: 'free' }
    const [kind, id] = moveTo.split(':')
    if (kind === 'goal') return { kind: 'move', to: { goalId: id } }
    const bill = targets.bills.find((b) => b.id === id)
    return {
      kind: 'move',
      to: { billId: id, occurrence: bill?.nextDue ?? null },
    }
  }

  const block =
    held <= 0
      ? null
      : choice === 'move' && !moveTo
        ? 'Pick where the money goes'
        : choice === 'spent' && spentFrom.block
          ? spentFrom.block
          : choice === 'spent' && !categoryId
            ? 'Pick what it was spent on'
            : null

  const submit = async () => {
    if (block) return
    setBusy(true)
    try {
      if (info.kind === 'goal') {
        if (held > 0 && choice === 'spent')
          await markGoalSpent(owner.id, {
            parts: spentFrom.parts,
            categoryId: categoryId ?? undefined,
          })
        else await closeGoal(owner.id, { leftover: leftover() })
      } else await closeBill(owner.id, { leftover: leftover() })
      toast(`${info.name} is done`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const options: Array<{ value: Choice; title: string; sub: string }> = [
    ...(isGoal
      ? [
          {
            value: 'spent' as const,
            title: 'I spent it',
            sub: `It was used for ${info.name}. We record what each wallet paid.`,
          },
        ]
      : []),
    {
      value: 'free',
      title: 'Free it up',
      sub: 'The money stays in its wallets as free to spend.',
    },
    {
      value: 'move',
      title: 'Move it to another bill or goal',
      sub: 'Give the money a new job.',
    },
  ]

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      contentClassName="sm:max-w-[480px]"
      footer={
        <DialogActions
          hint={block}
          onCancel={onClose}
          ready={block === null}
          disabled={busy}
          submitLabel={verb}
          onSubmit={() => void submit()}
        />
      }
    >
      {goalStatus ? (
        <div className="rounded-[14px] bg-fp-surface-2 px-[14px] py-3">
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="font-bold">
              {money(goalStatus.progress, currency)} saved
              {goalStatus.target > 0
                ? ` of ${money(goalStatus.target, currency)}`
                : ''}
            </span>
            {goalStatus.target > 0 ? (
              <span className="font-extrabold tabular-nums">
                {Math.round((goalStatus.progress / goalStatus.target) * 100)}%
              </span>
            ) : null}
          </div>
          {goalStatus.target > 0 ? (
            <ProgressBar
              className="mt-2 h-2"
              value={goalStatus.progress}
              max={goalStatus.target}
              color={info.kind === 'goal' ? info.goal.color : ''}
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-[14px] bg-fp-surface-2 px-[14px] py-3 text-[13.5px] font-bold">
          {held > 0
            ? `${money(held, currency)} set aside for it`
            : 'Nothing is set aside for it.'}
        </div>
      )}

      {held > 0 ? (
        <>
          <p className="text-[14px] font-bold text-fp-text">
            What happens to the {money(held, currency)} set aside?
          </p>
          <div
            role="radiogroup"
            aria-label="What happens to the money?"
            className="flex flex-col gap-2"
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={choice === o.value}
                onClick={() => setChoice(o.value)}
                className={cn(
                  'flex items-start gap-[11px] rounded-[14px] border-[1.5px] px-[14px] py-3 text-start transition',
                  choice === o.value
                    ? 'border-fp-accent bg-fp-accent-soft'
                    : 'border-fp-border hover:border-fp-border-strong',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-[2px] flex size-[18px] flex-none items-center justify-center rounded-full border-2',
                    choice === o.value
                      ? 'border-fp-accent'
                      : 'border-fp-border-strong',
                  )}
                >
                  {choice === o.value ? (
                    <span className="size-2 rounded-full bg-fp-accent" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold">{o.title}</span>
                  <span className="mt-[2px] block text-[12.5px] text-fp-text-2">
                    {o.sub}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {choice === 'move' ? (
            <div>
              <FieldLabel>Move to</FieldLabel>
              <Select value={moveTo || undefined} onValueChange={setMoveTo}>
                <SelectTrigger aria-label="Move to" className="w-full">
                  <SelectValue placeholder="Pick a bill or goal" />
                </SelectTrigger>
                <SelectContent>
                  {targets.goals.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>Goals</SelectLabel>
                      {targets.goals.map((g) => (
                        <SelectItem key={g.id} value={`goal:${g.id}`}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {targets.bills.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>Bills</SelectLabel>
                      {targets.bills.map((b) => (
                        <SelectItem key={b.id} value={`bill:${b.id}`}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {choice === 'spent' ? (
            <>
              <SpentFrom
                state={spentFrom}
                wallets={wallets.list}
                currency={currency}
              />
              <div>
                <FieldLabel>What was it spent on?</FieldLabel>
                <CategoryPicker
                  type="spend"
                  categoryId={categoryId}
                  onChange={setCategoryId}
                  none={
                    categoryId === null
                      ? { label: 'Choose a category', onPick: () => undefined }
                      : undefined
                  }
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </ResponsiveDialog>
  )
}
