import { useState } from 'react'
import { History, Pencil } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import type {
  PayloadNode,
  SampleReading,
} from '#/features/integrations/data/payloadTree'
import { readSample } from '#/features/integrations/data/payloadTree'
import type { Binding } from '#/features/integrations/data/ruleDraft'
import type { LastPayloadState } from '#/features/integrations/hooks/useRuleEditor'
import { SMALL_BUTTON } from './buttonStyles'
import { PayloadTree } from './PayloadTree'

type Props = {
  sample: string
  reading: SampleReading
  tree: PayloadNode | null
  maxBytes: number
  online: boolean
  lastPayload: LastPayloadState
  onSample: (text: string) => void
  onLoadLast: () => void
  onBind: (binding: Binding) => void
  marks: ReadonlyMap<string, string[]>
  highlighted: ReadonlySet<string>
  targetLabel: string | null
}

const kb = (bytes: number) => Math.round(bytes / 1024)

function problemText(reading: SampleReading, maxBytes: number): string | null {
  if (reading.ok) return null
  switch (reading.problem) {
    case 'empty':
      return null
    case 'too_large':
      return `That’s larger than the ${kb(maxBytes)} KB a webhook can send.`
    case 'not_object':
      return 'Means reads a JSON object — the payload has to start with {.'
    case 'invalid':
      return 'That isn’t valid JSON yet.'
  }
}

const LAST_TEXT: Partial<Record<LastPayloadState, string>> = {
  none: 'No payloads yet. Send one from your app and it will appear here to build a rule from.',
  failed:
    'Couldn’t load the last payload. Check your connection and try again.',
}

/** The sample the rule is built from: pasted, or the last one this key received. */
export function SamplePayloadPane({
  sample,
  reading,
  tree,
  maxBytes,
  online,
  lastPayload,
  onSample,
  onLoadLast,
  onBind,
  marks,
  highlighted,
  targetLabel,
}: Props) {
  const [editing, setEditing] = useState(!reading.ok)
  const showTree = tree !== null && !editing
  const problem = problemText(reading, maxBytes)
  const lastText = LAST_TEXT[lastPayload]

  return (
    <section aria-labelledby="sample-heading" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="sample-heading" className="text-[15px] font-extrabold">
          Sample payload
        </h4>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="quiet"
            disabled={!online || lastPayload === 'loading'}
            onClick={() => {
              setEditing(false)
              onLoadLast()
            }}
            className={`${SMALL_BUTTON} gap-1.5`}
          >
            <History size={14} strokeWidth={2} />
            {lastPayload === 'loading' ? 'Loading…' : 'Use last payload'}
          </Button>
          {showTree ? (
            <Button
              type="button"
              variant="quiet"
              onClick={() => setEditing(true)}
              className={`${SMALL_BUTTON} gap-1.5`}
            >
              <Pencil size={13} strokeWidth={2} />
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      {showTree ? (
        <>
          <p className="text-[12.5px] text-fp-text-2">
            {targetLabel
              ? `Tap a value — or one word of a longer one — to fill ${targetLabel}.`
              : 'Choose a field, then tap the value it should read.'}
          </p>
          <PayloadTree
            key={sample}
            root={tree}
            onBind={onBind}
            marks={marks}
            highlighted={highlighted}
            targetLabel={targetLabel}
            label="Sample payload"
          />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="sample-text" className="sr-only">
            Paste a payload
          </label>
          <Textarea
            id="sample-text"
            dir="ltr"
            rows={8}
            value={sample}
            spellCheck={false}
            placeholder={
              'Paste what your app sends, e.g.\n{"text": "SAR 152.75 spent at CARREFOUR on 23/09"}'
            }
            aria-invalid={problem ? true : undefined}
            aria-describedby="sample-problem"
            onChange={(e) => onSample(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text')
              if (!sample.trim() && readSample(pasted, maxBytes).ok) {
                setEditing(false)
              }
            }}
            className="min-h-[150px] text-start font-mono text-[12.5px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              id="sample-problem"
              className={`text-[12px] font-medium ${problem ? 'font-semibold text-fp-danger' : 'text-fp-text-3'}`}
            >
              {problem ??
                'Paste it and the tree appears — then tap values instead of typing paths.'}
            </p>
            {tree ? (
              <Button
                type="button"
                variant="quiet"
                onClick={() => setEditing(false)}
                className={SMALL_BUTTON}
              >
                Show as a tree
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {lastText ? (
        <p role="status" className="text-[12.5px] text-fp-text-2">
          {lastText}
        </p>
      ) : null}
    </section>
  )
}
