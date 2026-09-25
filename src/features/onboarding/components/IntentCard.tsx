import { Icon } from '#/components/icons/Icon'
import type { Intent } from '../data/packs'
import { SelectMark } from './SelectMark'
import { selectableCard } from './selectableCard'

type Props = {
  intent: Intent
  on: boolean
  onToggle: () => void
}

export function IntentCard({ intent, on, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={selectableCard(
        on,
        'flex items-start gap-[13px] rounded-2xl px-4 py-[15px]',
      )}
    >
      <span className="flex size-[38px] flex-none items-center justify-center rounded-[11px] bg-fp-surface-2 text-fp-accent-ink">
        <Icon id={intent.icon} size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold tracking-[-0.01em]">
          {intent.title}
        </span>
        <span className="mt-[3px] block text-[13px] leading-[1.45] text-fp-text-2">
          {intent.sub}
        </span>
      </span>
      <SelectMark on={on} kind="check" />
    </button>
  )
}
