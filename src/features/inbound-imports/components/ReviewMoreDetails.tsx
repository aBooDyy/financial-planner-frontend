import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'

type Props = {
  /** What the folded row says is inside ("Spend · Careem · Oct 21"). */
  summary: string
  /** Open from the start, when something only these details can give is still missing. */
  defaultOpen: boolean
  children: ReactNode
}

/** The entry's secondary details, folded to one line so the card stays short. */
export function ReviewMoreDetails({ summary, defaultOpen, children }: Props) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/more">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] py-1.5 text-start text-[13px]">
        <span className="font-bold text-fp-text-2">More details</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-fp-text-3">
          <bdi>{summary}</bdi>
        </span>
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={2.2}
          className="shrink-0 text-fp-text-3 transition-transform group-data-[state=open]/more:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
