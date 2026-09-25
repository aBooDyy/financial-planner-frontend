import type { Pack } from '../data/packs'
import { selectableCard } from './selectableCard'

type Props = {
  pack: Pack
  on: boolean
  suggested: boolean
  count: number
  /** Colours of the pack's first few spending categories. */
  dots: string[]
  onPick: () => void
}

export function PackCard({ pack, on, suggested, count, dots, onPick }: Props) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={selectableCard(
        on,
        'relative flex w-[150px] min-w-0 flex-none snap-start flex-col items-start gap-1 rounded-[14px] px-[13px] pt-[13px] pb-3 md:w-auto',
      )}
    >
      {suggested && (
        <span className="absolute -top-[9px] start-[11px] rounded-full bg-fp-accent px-[7px] py-0.5 text-[10.5px] font-bold tracking-[0.04em] text-white uppercase">
          Suggested
        </span>
      )}
      <span aria-hidden className="mb-1.5 flex gap-[3px]">
        {dots.map((color, i) => (
          <span
            key={i}
            className="size-2 rounded-full"
            style={{ background: color }}
          />
        ))}
      </span>
      <span className="text-[14px] font-bold tracking-[-0.01em]">
        {pack.name}
      </span>
      <span className="text-[12px] leading-[1.4] text-fp-text-2">
        {pack.desc}
      </span>
      <span className="mt-1 text-[11.5px] font-semibold whitespace-nowrap text-fp-text-3">
        {count} categories
      </span>
    </button>
  )
}
