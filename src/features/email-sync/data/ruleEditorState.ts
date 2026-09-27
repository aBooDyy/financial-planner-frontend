import type {
  CurrencyMode,
  DecimalStyle,
  EmailRuleDraft,
  EmailRuleSet,
  EmailSample,
  ExtractField,
  FieldPick,
  LearnResult,
  RuleFilter,
} from '#/features/email-sync/api/types'
import type { CurrencyCode } from '#/lib/currency'
import { labelCandidates } from './labels'
import {
  blankMapping,
  firstTarget,
  keepLabelLine,
  learnRequestOf,
  nextTarget,
  signatureOf,
  withLabelLine,
  withPick,
} from './mapping'
import type { Mapping } from './mapping'
import { cleanTerms, newRule, sameRules, sendable, toDraft } from './ruleDraft'
import type { RuleDraft } from './ruleDraft'

export type OpenRule = {
  /** Where the rule sits (or will sit, for a new one) in the set. */
  index: number
  draft: RuleDraft
  isNew: boolean
  mapping: Mapping
  target: ExtractField | null
  /** The field whose label the next tap on the sample names, instead of a value. */
  labelFor: ExtractField | null
  /** The learn request the draft's template answers; null when it came with the rule. */
  learnedFor: string | null
  /**
   * The filter still says only what the sample suggested, so a learned suggestion may refine
   * it. The first edit by hand makes it the user's.
   */
  autoFilter: boolean
}

export type RuleEditorState = {
  status: 'loading' | 'ready' | 'failed'
  /** The saved set's version — what the next save must send back. */
  version: string | null
  saved: RuleDraft[]
  rules: RuleDraft[]
  open: OpenRule | null
}

/** The fields of a rule a form edits directly; the filter and template have their own paths. */
export type RuleSettingsPatch = Partial<
  Pick<
    RuleDraft,
    | 'name'
    | 'enabled'
    | 'walletId'
    | 'type'
    | 'categoryId'
    | 'defaultMerchant'
    | 'autoConfirm'
  >
>

export type RuleEditorAction =
  | { type: 'loaded'; set: EmailRuleSet }
  | { type: 'failed' }
  | { type: 'add' }
  | { type: 'open'; index: number }
  | { type: 'close'; commit: boolean }
  | { type: 'remove'; index: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'toggleEnabled'; index: number }
  | { type: 'edit'; patch: RuleSettingsPatch }
  | { type: 'editFilter'; patch: Partial<RuleFilter> }
  | { type: 'useSample'; sample: EmailSample; similar: EmailSample[] }
  | { type: 'target'; target: ExtractField | null }
  | { type: 'pick'; pick: FieldPick }
  | { type: 'setPick'; field: ExtractField; pick: FieldPick }
  | { type: 'clearPick'; field: ExtractField }
  | { type: 'labelMode'; field: ExtractField | null }
  | { type: 'pickLabel'; line: number }
  | { type: 'clearLabel'; field: ExtractField }
  | { type: 'decimal'; style: DecimalStyle }
  | { type: 'currency'; mode: CurrencyMode; code: CurrencyCode | null }
  | { type: 'learned'; signature: string; result: LearnResult }
  | { type: 'startFrom'; ruleId: string | null; rulesMax: number }

export const initialRuleEditorState = (): RuleEditorState => ({
  status: 'loading',
  version: null,
  saved: [],
  rules: [],
  open: null,
})

const opened = (index: number, draft: RuleDraft, isNew: boolean): OpenRule => {
  const mapping = blankMapping(draft.template)
  return {
    index,
    draft,
    isNew,
    mapping,
    target: firstTarget(mapping),
    labelFor: null,
    learnedFor: null,
    autoFilter: isNew,
  }
}

const withOpen = (
  state: RuleEditorState,
  change: (open: OpenRule) => OpenRule,
): RuleEditorState =>
  state.open ? { ...state, open: change(state.open) } : state

const withMapping = (open: OpenRule, mapping: Mapping): OpenRule => ({
  ...open,
  mapping,
})

/** Filter terms as the user left them: trimmed, deduped, senders lower-cased. */
const mergeFilter = (
  filter: RuleFilter,
  patch: Partial<RuleFilter>,
): RuleFilter => {
  const next = { ...filter, ...patch }
  return {
    senders: cleanTerms(next.senders.map((s) => s.toLowerCase())),
    subjectAny: cleanTerms(next.subjectAny),
    bodyAny: cleanTerms(next.bodyAny),
    excludeAny: cleanTerms(next.excludeAny),
  }
}

export function ruleEditorReducer(
  state: RuleEditorState,
  action: RuleEditorAction,
): RuleEditorState {
  switch (action.type) {
    case 'loaded': {
      const rules = action.set.rules.map(toDraft)
      return {
        ...state,
        status: 'ready',
        version: action.set.version,
        saved: rules,
        rules,
      }
    }
    case 'failed':
      return { ...state, status: 'failed' }
    case 'add':
      return {
        ...state,
        open: opened(state.rules.length, newRule(), true),
      }
    case 'open': {
      if (action.index < 0 || action.index >= state.rules.length) return state
      return {
        ...state,
        open: opened(action.index, state.rules[action.index], false),
      }
    }
    case 'close': {
      const { open } = state
      if (!open) return state
      const rules = !action.commit
        ? state.rules
        : open.isNew
          ? [...state.rules, open.draft]
          : state.rules.map((r, i) => (i === open.index ? open.draft : r))
      return { ...state, rules, open: null }
    }
    case 'remove':
      return {
        ...state,
        rules: state.rules.filter((_, i) => i !== action.index),
      }
    case 'move': {
      const { from, to } = action
      if (from === to || to < 0 || to >= state.rules.length) return state
      const rules = [...state.rules]
      const [moved] = rules.splice(from, 1)
      rules.splice(to, 0, moved)
      return { ...state, rules }
    }
    case 'toggleEnabled':
      return {
        ...state,
        rules: state.rules.map((r, i) =>
          i === action.index ? { ...r, enabled: !r.enabled } : r,
        ),
      }
    case 'edit':
      return withOpen(state, (open) => {
        const draft = { ...open.draft, ...action.patch }
        if (action.patch.type && action.patch.type !== open.draft.type)
          draft.categoryId = null
        if (draft.walletId === null) draft.autoConfirm = false
        return { ...open, draft }
      })
    case 'editFilter':
      return withOpen(state, (open) => ({
        ...open,
        autoFilter: false,
        draft: {
          ...open.draft,
          filter: mergeFilter(open.draft.filter, action.patch),
        },
      }))
    case 'useSample':
      return withOpen(state, (open) => {
        const mapping: Mapping = {
          ...open.mapping,
          sample: action.sample,
          similar: action.similar,
          picks: { amount: null, currency: null, merchant: null },
        }
        const sender = action.sample.senderEmail.toLowerCase()
        const draft = open.autoFilter
          ? {
              ...open.draft,
              filter: { ...open.draft.filter, senders: [sender] },
              name:
                open.draft.name ||
                action.sample.senderName ||
                action.sample.senderEmail,
            }
          : open.draft
        return {
          ...open,
          draft,
          mapping,
          target: firstTarget(mapping),
          labelFor: null,
        }
      })
    case 'target':
      return withOpen(state, (open) => ({
        ...open,
        target: action.target,
        labelFor: null,
      }))
    case 'pick':
      return withOpen(state, (open) => {
        if (!open.target || !open.mapping.sample) return open
        const mapping = withPick(open.mapping, open.target, action.pick)
        return {
          ...withMapping(open, mapping),
          target: nextTarget(mapping, open.target),
        }
      })
    case 'setPick':
      return withOpen(state, (open) =>
        withMapping(
          open,
          withPick(
            open.mapping,
            action.field,
            keepLabelLine(open.mapping.picks[action.field], action.pick),
          ),
        ),
      )
    case 'clearPick':
      return withOpen(state, (open) => ({
        ...withMapping(open, withPick(open.mapping, action.field, null)),
        target: action.field,
        labelFor: open.labelFor === action.field ? null : open.labelFor,
      }))
    case 'labelMode':
      return withOpen(state, (open) =>
        action.field === null || open.mapping.picks[action.field]
          ? { ...open, labelFor: action.field }
          : open,
      )
    case 'pickLabel':
      return withOpen(state, (open) => {
        const field = open.labelFor
        const pick = field ? open.mapping.picks[field] : null
        const lines = open.mapping.sample?.bodyLines
        if (!field || !pick || !lines) return open
        if (!labelCandidates(lines, pick, field).has(action.line)) return open
        return {
          ...withMapping(open, withLabelLine(open.mapping, field, action.line)),
          labelFor: null,
        }
      })
    case 'clearLabel':
      return withOpen(state, (open) => ({
        ...withMapping(
          open,
          withLabelLine(open.mapping, action.field, undefined),
        ),
        labelFor: open.labelFor === action.field ? null : open.labelFor,
      }))
    case 'decimal':
      return withOpen(state, (open) =>
        withMapping(open, {
          ...open.mapping,
          options: { ...open.mapping.options, decimal: action.style },
        }),
      )
    case 'currency':
      return withOpen(state, (open) => {
        const mapping: Mapping = {
          ...open.mapping,
          options: {
            ...open.mapping.options,
            currency: { mode: action.mode, code: action.code },
          },
        }
        const fixed = action.mode === 'fixed'
        const target =
          fixed && open.target === 'currency'
            ? firstTarget(mapping)
            : open.target
        const labelFor =
          fixed && open.labelFor === 'currency' ? null : open.labelFor
        return { ...withMapping(open, mapping), target, labelFor }
      })
    case 'learned':
      return withOpen(state, (open) => {
        if (signatureOf(learnRequestOf(open.mapping)) !== action.signature)
          return open
        const suggested = action.result.suggestedFilter
        const filter =
          open.autoFilter && suggested.senders.length > 0
            ? mergeFilter(open.draft.filter, suggested)
            : open.draft.filter
        return {
          ...open,
          learnedFor: action.signature,
          draft: { ...open.draft, template: action.result.template, filter },
        }
      })
    case 'startFrom': {
      const handled = action.ruleId
        ? state.rules.findIndex((rule) => rule.id === action.ruleId)
        : -1
      if (handled >= 0)
        return ruleEditorReducer(state, { type: 'open', index: handled })
      if (state.rules.length < action.rulesMax)
        return ruleEditorReducer(state, { type: 'add' })
      return ruleEditorReducer(state, { type: 'open', index: 0 })
    }
  }
}

// --- Derived ------------------------------------------------------------------------------

/**
 * Whether the open rule's template answers the picks on screen. A rule opened without a
 * sample keeps the template it came with; once a sample is mapped, only a template learned
 * from exactly those picks will do.
 */
export function templateCurrent(open: OpenRule): boolean {
  if (!open.mapping.sample) return open.draft.template !== null
  const signature = signatureOf(learnRequestOf(open.mapping))
  return signature !== null && signature === open.learnedFor
}

/** The set with the open rule's edits in place — what a test tries. Rules that cannot be sent
 *  yet (a new rule with nothing learned) leave the set, and the focus moves with them. */
export function workingSet(state: Pick<RuleEditorState, 'rules' | 'open'>): {
  rules: EmailRuleDraft[]
  focusIndex: number | null
} {
  const { open } = state
  const drafts = !open
    ? state.rules
    : open.isNew
      ? [...state.rules, open.draft]
      : state.rules.map((r, i) => (i === open.index ? open.draft : r))
  const rules: EmailRuleDraft[] = []
  let focusIndex: number | null = null
  drafts.forEach((draft, index) => {
    const wire = sendable(draft)
    if (!wire) return
    if (open && index === open.index) focusIndex = rules.length
    rules.push(wire)
  })
  return { rules, focusIndex }
}

/** Whether leaving the open rule without Done would lose something typed, picked or learned. */
export function openRuleEdited(
  state: Pick<RuleEditorState, 'rules' | 'open'>,
): boolean {
  const { open } = state
  if (!open) return false
  const before = open.isNew ? newRule() : state.rules[open.index]
  return !sameRules([open.draft], [before])
}
