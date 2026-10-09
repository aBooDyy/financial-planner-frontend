import type {
  CurrencyMode,
  DecimalStyle,
  ExtractField,
  ExtractionTemplate,
  FieldPick,
  TextSample,
} from '#/features/text-templates/api/types'
import type { CurrencyCode } from '#/lib/currency'
import { labelCandidates } from './labels'
import {
  blankMapping,
  firstTarget,
  keepLabelLine,
  nextTarget,
  withLabelLine,
  withPick,
} from './mapping'
import type { Mapping } from './mapping'

/** The taps on a sample a template is learned from, and what the next tap fills. */
export type Tapping<TSample extends TextSample = TextSample> = {
  mapping: Mapping<TSample>
  target: ExtractField | null
  /** The field whose label the next tap on the sample names, instead of a value. */
  labelFor: ExtractField | null
}

export type TappingAction =
  | { type: 'target'; target: ExtractField | null }
  | { type: 'pick'; pick: FieldPick }
  | { type: 'setPick'; field: ExtractField; pick: FieldPick }
  | { type: 'clearPick'; field: ExtractField }
  | { type: 'labelMode'; field: ExtractField | null }
  | { type: 'pickLabel'; line: number }
  | { type: 'clearLabel'; field: ExtractField }
  | { type: 'decimal'; style: DecimalStyle }
  | { type: 'currency'; mode: CurrencyMode; code: CurrencyCode | null }

const TAPPING_ACTIONS = new Set<string>([
  'target',
  'pick',
  'setPick',
  'clearPick',
  'labelMode',
  'pickLabel',
  'clearLabel',
  'decimal',
  'currency',
])

export const isTappingAction = (action: {
  type: string
}): action is TappingAction => TAPPING_ACTIONS.has(action.type)

/** Nothing tapped yet; the reading options start from what the rule already knows. */
export function tappingFor<TSample extends TextSample>(
  template: ExtractionTemplate | null,
): Tapping<TSample> {
  const mapping: Mapping<TSample> = blankMapping(template)
  return { mapping, target: firstTarget(mapping), labelFor: null }
}

/** A new sample to tap on: every pick made on the previous one is dropped. */
export function withSample<
  TSample extends TextSample,
  TTapping extends Tapping<TSample>,
>(tapping: TTapping, sample: TSample, similar: TSample[]): TTapping {
  const mapping: Mapping<TSample> = {
    ...tapping.mapping,
    sample,
    similar,
    picks: { amount: null, currency: null, merchant: null },
  }
  return { ...tapping, mapping, target: firstTarget(mapping), labelFor: null }
}

const withMapping = <T extends Tapping<TextSample>>(
  tapping: T,
  mapping: T['mapping'],
): T => ({ ...tapping, mapping })

export function tappingReducer<T extends Tapping<TextSample>>(
  tapping: T,
  action: TappingAction,
): T {
  switch (action.type) {
    case 'target':
      return { ...tapping, target: action.target, labelFor: null }
    case 'pick': {
      if (!tapping.target || !tapping.mapping.sample) return tapping
      const mapping = withPick(tapping.mapping, tapping.target, action.pick)
      return {
        ...withMapping(tapping, mapping),
        target: nextTarget(mapping, tapping.target),
      }
    }
    case 'setPick':
      return withMapping(
        tapping,
        withPick(
          tapping.mapping,
          action.field,
          keepLabelLine(tapping.mapping.picks[action.field], action.pick),
        ),
      )
    case 'clearPick':
      return {
        ...withMapping(tapping, withPick(tapping.mapping, action.field, null)),
        target: action.field,
        labelFor: tapping.labelFor === action.field ? null : tapping.labelFor,
      }
    case 'labelMode':
      return action.field === null || tapping.mapping.picks[action.field]
        ? { ...tapping, labelFor: action.field }
        : tapping
    case 'pickLabel': {
      const field = tapping.labelFor
      const pick = field ? tapping.mapping.picks[field] : null
      const lines = tapping.mapping.sample?.bodyLines
      if (!field || !pick || !lines) return tapping
      if (!labelCandidates(lines, pick, field).has(action.line)) return tapping
      return {
        ...withMapping(
          tapping,
          withLabelLine(tapping.mapping, field, action.line),
        ),
        labelFor: null,
      }
    }
    case 'clearLabel':
      return {
        ...withMapping(
          tapping,
          withLabelLine(tapping.mapping, action.field, undefined),
        ),
        labelFor: tapping.labelFor === action.field ? null : tapping.labelFor,
      }
    case 'decimal':
      return withMapping(tapping, {
        ...tapping.mapping,
        options: { ...tapping.mapping.options, decimal: action.style },
      })
    case 'currency': {
      const mapping: T['mapping'] = {
        ...tapping.mapping,
        options: {
          ...tapping.mapping.options,
          currency: { mode: action.mode, code: action.code },
        },
      }
      const fixed = action.mode === 'fixed'
      return {
        ...withMapping(tapping, mapping),
        target:
          fixed && tapping.target === 'currency'
            ? firstTarget(mapping)
            : tapping.target,
        labelFor:
          fixed && tapping.labelFor === 'currency' ? null : tapping.labelFor,
      }
    }
  }
}
