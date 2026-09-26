import type { ReactNode } from 'react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { FieldLabel } from '#/components/FieldLabel'
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
        'rounded-[14px] border-[1.5px] transition-colors',
        active
          ? 'border-fp-accent bg-[color-mix(in_oklab,var(--fp-accent)_5%,var(--fp-surface))]'
          : 'border-fp-border bg-fp-surface hover:border-fp-border-strong',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => onSelect(mode)}
        className="flex w-full items-start gap-[11px] px-[14px] py-3 text-start"
      >
        <span
          aria-hidden
          className={cn(
            'mt-px flex size-[18px] flex-none items-center justify-center rounded-full border-2',
            active ? 'border-fp-accent' : 'border-fp-border-strong',
          )}
        >
          {active ? (
            <span className="size-2 rounded-full bg-fp-accent" />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span className="text-[14px] font-bold text-fp-text">{label}</span>
          <span className="text-[12.5px] leading-[1.45] text-fp-text-2">
            {hint}
          </span>
        </span>
      </button>
      {active && children ? (
        <div className="-mt-[2px] pe-[14px] pb-3 ps-[43px]">{children}</div>
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
    <div className="flex flex-col gap-[10px]">
      <p>{filedSummary(target)}</p>
      <div
        role="radiogroup"
        aria-label="What happens to them"
        className="flex flex-col gap-[10px]"
      >
        {choice.targets.length > 0 ? (
          <ChoiceCard
            mode="move"
            current={choice.mode}
            label="Move them to another category"
            hint="Nothing is lost — they’re re-filed under the category you pick."
            onSelect={choice.setMode}
          >
            <FieldLabel htmlFor="move-target">Move them to</FieldLabel>
            <MoveTargetSelect
              id="move-target"
              className="bg-fp-surface"
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
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={target ? title(target) : ''}
      confirmLabel={moving ? 'Delete & move' : 'Delete'}
      confirmDisabled={blocked}
      contentClassName="sm:max-w-[460px]"
      onConfirm={() => onConfirm(choice.resolvedMoveTo)}
    >
      {target === null ? null : choice.hasFiled ? (
        <FiledChoice target={target} choice={choice} />
      ) : (
        <p>{emptyBody(target)}</p>
      )}
    </ConfirmDialog>
  )
}
