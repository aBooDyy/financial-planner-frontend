import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { messageFields } from '#/features/integrations/data/messageFields'
import type { SampleReading } from '#/features/integrations/data/payloadTree'
import type { RuleEditorModel } from '#/features/integrations/hooks/useRuleEditor'
import { EditorSection } from '#/features/text-templates/components/EditorSection'
import { FieldLabels } from '#/features/text-templates/components/FieldLabels'
import { FieldTargetChips } from '#/features/text-templates/components/FieldTargetChips'
import { SampleLines } from '#/features/text-templates/components/SampleLines'
import { TapHint } from '#/features/text-templates/components/TapHint'
import {
  labelLineMarks,
  labelModeOf,
} from '#/features/text-templates/data/labels'
import { pickForLine } from '#/features/text-templates/data/mapping'
import type { Tapping } from '#/features/text-templates/data/tapping'
import { MessageFieldSelect } from './MessageFieldSelect'
import { SMALL_BUTTON } from './buttonStyles'

type Props = {
  model: RuleEditorModel
  tapping: Tapping
  textPath: string | null
  pathError?: string
  online: boolean
  maxBytes: number
}

const kb = (bytes: number) => Math.round(bytes / 1024)

function problemText(
  reading: SampleReading,
  textPath: string | null,
  found: boolean,
  maxBytes: number,
): string | null {
  if (reading.ok) {
    if (reading.kind === 'text')
      return textPath === null
        ? null
        : `That’s a plain text message — this rule reads the message in ${textPath}.`
    if (textPath === null) return null
    return found ? null : `This sample has no text in ${textPath}.`
  }
  switch (reading.problem) {
    case 'too_large':
      return `That’s larger than the ${kb(maxBytes)} KB a webhook can send.`
    case 'invalid':
      return 'That opens like JSON but doesn’t parse.'
    case 'not_object':
      return 'A JSON sample has to be an object: {…}.'
    case 'empty':
      return null
  }
}

/**
 * Step 1 of a text rule: the message it is built from — pasted, or the last one the key
 * received, the whole body or one field of a JSON payload — and the taps on its lines that
 * say where the amount, currency and merchant are.
 */
export function TextSampleStep({
  model,
  tapping,
  textPath,
  pathError,
  online,
  maxBytes,
}: Props) {
  const sample = tapping.mapping.sample
  const { reading } = model
  const isJson = reading.ok && reading.kind === 'json'
  const fields = useMemo(
    () =>
      reading.ok && reading.kind === 'json' ? messageFields(reading.value) : [],
    [reading],
  )
  const [editing, setEditing] = useState(sample === null)
  const { mapping, target, labelFor } = tapping
  const labels = model.learned?.labels ?? null
  const merchantReading = model.learned?.reading.fields.merchant
  const merchantGuess =
    merchantReading?.status === 'heuristic' ? merchantReading.line : null
  const problem = problemText(reading, textPath, sample !== null, maxBytes)
  const showLines = sample !== null && !editing

  const tap = (line: number) => {
    if (!sample) return
    if (labelFor) model.tap({ type: 'pickLabel', line })
    else if (target)
      model.tap({
        type: 'pick',
        pick: pickForLine(sample.bodyLines[line] ?? '', line, target),
      })
  }

  return (
    <EditorSection
      step={1}
      title="A sample message"
      done={sample !== null}
      aside={
        <div className="flex gap-2">
          <Button
            type="button"
            variant="quiet"
            disabled={!online || model.lastPayload === 'loading'}
            onClick={() => {
              setEditing(false)
              void model.loadLastPayload()
            }}
            className={`${SMALL_BUTTON} gap-1.5`}
          >
            <History size={14} strokeWidth={2} />
            {model.lastPayload === 'loading' ? 'Loading…' : 'Use last received'}
          </Button>
          {showLines ? (
            <Button
              type="button"
              variant="quiet"
              onClick={() => setEditing(true)}
              className={SMALL_BUTTON}
            >
              Edit
            </Button>
          ) : null}
        </div>
      }
    >
      {isJson || textPath !== null ? (
        <MessageFieldSelect
          fields={fields}
          textPath={textPath}
          onChange={model.setTextPath}
          error={pathError}
        />
      ) : null}
      {showLines ? (
        <>
          <FieldTargetChips
            target={target}
            picks={mapping.picks}
            options={mapping.options}
            onTarget={(field) => model.tap({ type: 'target', target: field })}
          />
          <TapHint target={target} labelFor={labelFor} />
          <FieldLabels
            picks={mapping.picks}
            options={mapping.options}
            labels={labels}
            pending={model.learning.pending}
            labelFor={labelFor}
            onLabelMode={(field) => model.tap({ type: 'labelMode', field })}
            onAuto={(field) => model.tap({ type: 'clearLabel', field })}
          />
          <SampleLines
            sample={sample}
            noun="message"
            picks={mapping.picks}
            options={mapping.options}
            target={target}
            merchantGuess={merchantGuess}
            labelMarks={labelLineMarks(mapping.picks, mapping.options, labels)}
            labelMode={labelModeOf(sample, mapping.picks, labelFor)}
            onTap={tap}
          />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="text-sample" className="sr-only">
            Paste a text message
          </label>
          <Textarea
            id="text-sample"
            dir="auto"
            rows={6}
            value={model.sample}
            spellCheck={false}
            placeholder={
              'Paste a message your bank sent, e.g.\nPurchase of SAR 38.50 at CARREFOUR\n\nor the JSON it arrives in, e.g.\n{"message": "Purchase of SAR 38.50 …"}'
            }
            aria-invalid={problem ? true : undefined}
            aria-describedby="text-sample-problem"
            onChange={(e) => model.setSample(e.target.value)}
            className="min-h-[130px] text-start font-mono text-[12.5px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              id="text-sample-problem"
              className={`text-[12px] font-medium ${problem ? 'font-semibold text-fp-danger' : 'text-fp-text-3'}`}
            >
              {problem ??
                (isJson && textPath === null
                  ? 'Pick the field that holds the message, then tap its lines.'
                  : 'Paste it, then tap the lines with the amount and currency.')}
            </p>
            {sample ? (
              <Button
                type="button"
                variant="quiet"
                onClick={() => setEditing(false)}
                className={SMALL_BUTTON}
              >
                Tap its lines
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {model.lastPayload === 'none' ? (
        <p role="status" className="text-[12.5px] text-fp-text-2">
          Nothing received yet. Send a message from your phone and it will
          appear here.
        </p>
      ) : model.lastPayload === 'failed' ? (
        <p role="status" className="text-[12.5px] text-fp-text-2">
          Couldn’t load the last message. Check your connection and try again.
        </p>
      ) : null}
    </EditorSection>
  )
}
