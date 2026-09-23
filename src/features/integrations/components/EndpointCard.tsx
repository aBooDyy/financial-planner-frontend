import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { sampleCurl } from '#/features/integrations/data/curl'
import { CopyField } from './CopyField'

type Props = { endpoint: string }

/** The one thing everyone needs first: where to send. */
export function EndpointCard({ endpoint }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <div className="mb-2.5 text-[14.5px] font-bold">
        Your webhook endpoint
      </div>
      <CopyField value={endpoint} label="Webhook endpoint" />
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="text-[12.5px] text-fp-text-2">
            Send a POST with your key in the Authorization header.
          </span>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 bg-fp-surface px-3 py-[7px] text-[12.5px] font-semibold"
            >
              {open ? 'Hide curl' : 'Show curl'}
              <ChevronDown
                size={14}
                strokeWidth={2}
                className={open ? 'rotate-180 transition' : 'transition'}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <pre
            dir="ltr"
            className="mt-3 overflow-x-auto rounded-xl border border-fp-border bg-fp-surface-2 p-3 text-start font-mono text-[12px] leading-relaxed text-fp-text"
          >
            {sampleCurl(endpoint)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
