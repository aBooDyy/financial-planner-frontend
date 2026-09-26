import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { FieldLabel } from '#/components/FieldLabel'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import {
  filedCount,
  useDeleteChoice,
} from '#/features/categories/hooks/useDeleteChoice'
import type {
  DeleteChoice,
  DeleteTarget,
} from '#/features/categories/hooks/useDeleteChoice'
import { MoveTargetSelect } from './MoveTargetSelect'

type Props = {
  target: DeleteTarget | null
  catalog: CategoryCatalog
  onClose: () => void
  /** `moveToId` is where the rows go, or `null` when nothing is filed under it. */
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
    t.plannedCount > 0
      ? plural(t.plannedCount, 'planned item', 'planned items')
      : null,
  ].filter(Boolean)
  const where =
    t.subCount > 0 ? `“${t.name}” and its subcategories` : `“${t.name}”`
  const list =
    parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
      : parts[0]
  return `${list} ${filedCount(t) === 1 ? 'is' : 'are'} filed under ${where}. They move to the category you pick.`
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
      {choice.targets.length > 0 ? (
        <div className="flex flex-col gap-[6px]">
          <FieldLabel htmlFor="move-target">Move them to</FieldLabel>
          <MoveTargetSelect
            id="move-target"
            targets={choice.targets}
            value={choice.moveTo}
            onChange={choice.setMoveTo}
          />
        </div>
      ) : (
        <p>
          There’s no other {target.type === 'income' ? 'income' : 'spending'}{' '}
          category to move them to. Add one first.
        </p>
      )}
    </div>
  )
}

const emptyBody = (t: DeleteTarget) =>
  t.subCount > 0
    ? 'Nothing is filed under it or its subcategories. This can’t be undone.'
    : 'Nothing is filed under it. This can’t be undone.'

/** Deleting never deletes the ledger — whatever is filed under it moves where the user picks. */
export function DeleteCategoryDialog({
  target,
  catalog,
  onClose,
  onConfirm,
}: Props) {
  const choice = useDeleteChoice(target, catalog)
  const moving = choice.resolvedMoveTo !== null

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={target ? title(target) : ''}
      confirmLabel={moving ? 'Delete & move' : 'Delete'}
      confirmDisabled={choice.blocked}
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
