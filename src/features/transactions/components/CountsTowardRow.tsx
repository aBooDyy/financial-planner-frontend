import { ChevronRight } from 'lucide-react'
import type { CountsFace } from '#/features/transactions/hooks/useCountsToward'
import { cn } from '#/lib/utils'

type Props = {
  face: CountsFace
  onOpen: () => void
  invalid?: boolean
}

/** One line for what the entry counts toward; the list opens from it. */
export function CountsTowardRow({ face, onOpen, invalid = false }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Counts toward: ${face.name}`}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex w-full items-center gap-[10px] rounded-[14px] border-[1.5px] px-[14px] py-[13px] text-start transition hover:bg-fp-surface-2',
        invalid ? 'border-fp-danger' : 'border-fp-border',
      )}
    >
      <span className="text-[13px] font-bold whitespace-nowrap text-fp-text-2">
        Counts toward
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span
          aria-hidden
          className="mx-1 size-3 flex-none rounded-full"
          style={{ background: face.color ?? 'var(--fp-text-3)' }}
        />
        <span className="text-[14px] font-bold whitespace-nowrap">
          {face.name}
        </span>
        <span className="truncate text-[12px] text-fp-text-3">{face.sub}</span>
      </span>
      <ChevronRight
        size={15}
        strokeWidth={2.2}
        className="flex-none text-fp-text-3 rtl:-scale-x-100"
      />
    </button>
  )
}
