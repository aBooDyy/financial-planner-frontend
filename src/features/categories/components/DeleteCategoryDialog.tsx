import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { useDeleteChoice } from '#/features/categories/hooks/useDeleteChoice'
import type {
  DeleteChoice,
  DeleteMode,
  DeleteTarget,
} from '#/features/categories/hooks/useDeleteChoice'
import { cn } from '#/lib/utils'
import { MoveTargetSelect } from './MoveTargetSelect'

type Props = {
  target: DeleteTarget | null
  catalog: CategoryCatalog
  onClose: () => void
  /** `moveToId` is where the rows go, or `null` to leave them carrying their labels. */
  onConfirm: (moveToId: string | null) => void
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

const title = (t: DeleteTarget) =>
  t.subCount > 0
    ? `Delete “${t.name}” and its ${plural(t.subCount, 'subcategory', 'subcategories')}?`
    : `Delete “${t.name}”?`

function filedSummary(t: DeleteTarget): string {
  const parts = [
    t.txCount > 0 ? plural(t.txCount, 'transaction', 'transactions') : null,
    t.recurringCount > 0
      ? plural(t.recurringCount, 'recurring payment', 'recurring payments')
      : null,
  ].filter(Boolean)
  const where =
    t.subCount > 0 ? `“${t.name}” and its subcategories` : `“${t.name}”`
  return `${parts.join(' and ')} ${t.txCount + t.recurringCount === 1 ? 'is' : 'are'} filed under ${where}. What should happen to them?`
}

function ChoiceCard({
  mode,
  current,
  label,
  hint,
  onSelect,
  children,
}: {
  mode: DeleteMode
  current: DeleteMode
  label: string
  hint: string
  onSelect: (mode: DeleteMode) => void
  children?: ReactNode
}) {
  const active = mode === current
  return (
    <div
      className={cn(
        'rounded-[12px] border transition-colors',
        active
          ? 'border-fp-accent bg-fp-accent-soft'
          : 'border-fp-border-strong bg-fp-surface-2 hover:border-fp-text-3',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => onSelect(mode)}
        className="flex w-full items-start gap-[10px] px-[12px] py-[10px] text-start"
      >
        <span
          aria-hidden
          className={cn(
            'mt-[3px] flex size-[16px] flex-none items-center justify-center rounded-full border-[1.5px]',
            active ? 'border-fp-accent' : 'border-fp-border-strong',
          )}
        >
          {active ? (
            <span className="size-[8px] rounded-full bg-fp-accent" />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span
            className={cn(
              'text-[13.5px] font-semibold',
              active ? 'text-fp-accent-ink' : 'text-fp-text',
            )}
          >
            {label}
          </span>
          <span className="text-[12px] leading-[1.45] text-fp-text-3">
            {hint}
          </span>
        </span>
      </button>
      {active && children ? (
        <div className="px-[12px] pb-[12px] ps-[38px]">{children}</div>
      ) : null}
    </div>
  )
}

function FiledChoice({
  target,
  choice,
}: {
  target: DeleteTarget
  choice: DeleteChoice
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-fp-text-2">
        {filedSummary(target)}
      </p>
      <div role="radiogroup" className="flex flex-col gap-[8px]">
        {choice.targets.length > 0 ? (
          <ChoiceCard
            mode="move"
            current={choice.mode}
            label="Move them to another category"
            hint="Nothing is lost — they’re re-filed under the category you pick."
            onSelect={choice.setMode}
          >
            <MoveTargetSelect
              targets={choice.targets}
              value={choice.moveTo}
              onChange={choice.setMoveTo}
            />
          </ChoiceCard>
        ) : null}
        <ChoiceCard
          mode="keep"
          current={choice.mode}
          label="Keep them as they are"
          hint="They keep their current label, but it can no longer be edited or picked."
          onSelect={choice.setMode}
        />
      </div>
    </div>
  )
}

const emptyBody = (t: DeleteTarget) =>
  t.subCount > 0
    ? 'Nothing is filed under it or its subcategories. This can’t be undone.'
    : 'Nothing is filed under it. This can’t be undone.'

/** Deleting never deletes the ledger — the user decides where its rows go instead. */
export function DeleteCategoryDialog({
  target,
  catalog,
  onClose,
  onConfirm,
}: Props) {
  const choice = useDeleteChoice(target, catalog)
  const moving = choice.resolvedMoveTo !== null
  const blocked = choice.hasFiled && choice.mode === 'move' && !choice.moveTo

  return (
    <ResponsiveDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={target ? title(target) : ''}
      contentClassName="sm:max-w-[460px]"
      footer={
        <>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            autoFocus
            disabled={blocked}
            onClick={() => onConfirm(choice.resolvedMoveTo)}
          >
            {moving ? 'Delete & move' : 'Delete'}
          </Button>
        </>
      }
    >
      {target === null ? null : choice.hasFiled ? (
        <FiledChoice target={target} choice={choice} />
      ) : (
        <p className="text-[13px] leading-relaxed text-fp-text-2">
          {emptyBody(target)}
        </p>
      )}
    </ResponsiveDialog>
  )
}
