import { hasTemplate } from '#/features/integrations/api/ruleTypes'
import type {
  IntegrationRule,
  Locator,
  LocatorField,
  MatchCondition,
  RuleSet,
  TextFilter,
  TextRule,
} from '#/features/integrations/api/ruleTypes'
import type {
  ExtractionTemplate,
  Learned,
  TextSample,
} from '#/features/text-templates/api/types'
import {
  learnRequestOf,
  signatureOf,
} from '#/features/text-templates/data/mapping'
import {
  tappingFor,
  tappingReducer,
  withSample,
} from '#/features/text-templates/data/tapping'
import type {
  Tapping,
  TappingAction,
} from '#/features/text-templates/data/tapping'
import { cleanTerms } from '#/features/text-templates/data/terms'
import { readSample } from './payloadTree'
import {
  bindLocator,
  bindMatch,
  firstTarget,
  newRule,
  newTextRule,
  nextTarget,
  sendable,
  toDraft,
} from './ruleDraft'
import type { Binding, RuleDraft, RuleKind } from './ruleDraft'

/** What a tap on the payload fills: one of the rule's fields, or its condition. */
export type Target = LocatorField | 'match'

export type OpenRule = {
  /** Where the rule sits (or will sit, for a new one) in the set. */
  index: number
  draft: RuleDraft
  /** The rule as it was opened — what `draft` is compared with to tell an edit. */
  base: RuleDraft
  isNew: boolean
  /** A text rule's taps on the sample message; null for a JSON rule. */
  tapping: Tapping | null
  /** The learn request the text rule's template answers; null when it came with the rule. */
  learnedFor: string | null
}

export type RuleEditorState = {
  status: 'loading' | 'ready' | 'failed'
  /** The saved set's version — what the next save must send back. */
  version: string | null
  saved: RuleDraft[]
  rules: RuleDraft[]
  open: OpenRule | null
  target: Target | null
  /** Plausible reference nodes are lit after "Fix this". */
  highlightReference: boolean
  sample: string
}

/** The parts of a text rule a form edits directly. */
export type TextRulePatch = Partial<
  Pick<TextRule, 'walletId' | 'type' | 'categoryId' | 'defaultMerchant'>
>

export type RuleEditorAction =
  | { type: 'loaded'; set: RuleSet }
  | { type: 'failed' }
  /** Without a kind, a new rule reads whatever the sample is. */
  | { type: 'add'; kind?: RuleKind }
  | { type: 'open'; index: number }
  | { type: 'close'; commit: boolean }
  | { type: 'remove'; index: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'rename'; name: string }
  | { type: 'kind'; kind: RuleKind }
  | { type: 'setMatch'; match: MatchCondition | null }
  | { type: 'setLocator'; field: LocatorField; locator: Locator | null }
  | { type: 'target'; target: Target | null }
  | { type: 'bind'; binding: Binding }
  | { type: 'fixReference' }
  | { type: 'editText'; patch: TextRulePatch }
  | { type: 'textFilter'; patch: Partial<TextFilter> }
  | { type: 'tap'; action: TappingAction }
  | { type: 'learned'; signature: string; result: Learned }
  | { type: 'sample'; text: string }
  | { type: 'startFrom'; ruleId: string | null; rulesMax: number }

export const initialRuleEditorState = (sample = ''): RuleEditorState => ({
  status: 'loading',
  version: null,
  saved: [],
  rules: [],
  open: null,
  target: null,
  highlightReference: false,
  sample,
})

/** The sample as a text rule taps it, or null when it is empty or a JSON payload. */
export function textSampleOf(sample: string): TextSample | null {
  const reading = readSample(sample, Number.POSITIVE_INFINITY)
  return reading.ok && reading.kind === 'text'
    ? { bodyLines: reading.lines }
    : null
}

function tappingOn(
  template: ExtractionTemplate | null,
  sample: string,
): Tapping {
  const tapping = tappingFor<TextSample>(template)
  const text = textSampleOf(sample)
  return text ? withSample(tapping, text, []) : tapping
}

const opened = (
  index: number,
  draft: RuleDraft,
  isNew: boolean,
  sample: string,
): OpenRule => ({
  index,
  draft,
  base: draft,
  isNew,
  tapping: draft.text ? tappingOn(draft.text.template, sample) : null,
  learnedFor: null,
})

const withDraft = (
  state: RuleEditorState,
  change: (draft: RuleDraft) => RuleDraft,
): RuleEditorState =>
  state.open
    ? { ...state, open: { ...state.open, draft: change(state.open.draft) } }
    : state

const withText = (
  state: RuleEditorState,
  change: (text: TextRule) => TextRule,
): RuleEditorState =>
  withDraft(state, (d) => (d.text ? { ...d, text: change(d.text) } : d))

const setField = (
  draft: RuleDraft,
  field: LocatorField,
  locator: Locator | null,
): RuleDraft => {
  const fields = { ...draft.fields }
  if (locator) fields[field] = locator
  else delete fields[field]
  return { ...draft, fields }
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
    case 'add': {
      const kind = action.kind ?? (textSampleOf(state.sample) ? 'text' : 'json')
      const draft = newRule(state.rules.length, kind)
      return {
        ...state,
        open: opened(state.rules.length, draft, true, state.sample),
        target: firstTarget(draft.fields),
        highlightReference: false,
      }
    }
    case 'open': {
      if (action.index < 0 || action.index >= state.rules.length) return state
      const draft = state.rules[action.index]
      return {
        ...state,
        open: opened(action.index, draft, false, state.sample),
        target: firstTarget(draft.fields),
        highlightReference: false,
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
      return {
        ...state,
        rules,
        open: null,
        target: null,
        highlightReference: false,
      }
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
    case 'rename':
      return withDraft(state, (d) => ({ ...d, name: action.name }))
    case 'kind': {
      const { open } = state
      if (!open?.isNew) return state
      const draft: RuleDraft = {
        ...open.draft,
        match: null,
        fields: {},
        text: action.kind === 'text' ? newTextRule() : null,
      }
      return {
        ...state,
        open: {
          ...opened(open.index, draft, true, state.sample),
          base: open.base,
        },
        target: firstTarget(draft.fields),
        highlightReference: false,
      }
    }
    case 'setMatch':
      return withDraft(state, (d) => ({ ...d, match: action.match }))
    case 'setLocator':
      return withDraft(state, (d) => setField(d, action.field, action.locator))
    case 'target':
      return { ...state, target: action.target }
    case 'bind': {
      const { open, target } = state
      if (!open || !target || open.draft.text) return state
      if (target === 'match') {
        return {
          ...state,
          open: {
            ...open,
            draft: { ...open.draft, match: bindMatch(action.binding) },
          },
          target: firstTarget(open.draft.fields),
        }
      }
      const draft = setField(
        open.draft,
        target,
        bindLocator(target, open.draft.fields[target], action.binding),
      )
      return {
        ...state,
        open: { ...open, draft },
        target: nextTarget(draft.fields, target),
        highlightReference:
          target === 'external_id' ? false : state.highlightReference,
      }
    }
    case 'fixReference': {
      const next = withDraft(state, (d) =>
        d.fields.external_id ? d : setField(d, 'external_id', {}),
      )
      return { ...next, target: 'external_id', highlightReference: true }
    }
    case 'editText':
      return withText(state, (text) => {
        const next = { ...text, ...action.patch }
        if (action.patch.type && action.patch.type !== text.type)
          next.categoryId = null
        return next
      })
    case 'textFilter':
      return withText(state, (text) => {
        const filter = { ...text.filter, ...action.patch }
        return {
          ...text,
          filter: {
            textAny: cleanTerms(filter.textAny),
            excludeAny: cleanTerms(filter.excludeAny),
          },
        }
      })
    case 'tap': {
      const { open } = state
      if (!open?.tapping) return state
      return {
        ...state,
        open: { ...open, tapping: tappingReducer(open.tapping, action.action) },
      }
    }
    case 'learned': {
      const { open } = state
      if (!open?.tapping || !open.draft.text) return state
      if (
        signatureOf(learnRequestOf(open.tapping.mapping)) !== action.signature
      )
        return state
      return {
        ...state,
        open: {
          ...open,
          learnedFor: action.signature,
          draft: {
            ...open.draft,
            text: { ...open.draft.text, template: action.result.template },
          },
        },
      }
    }
    case 'sample': {
      const { open } = state
      const next = { ...state, sample: action.text }
      if (!open?.draft.text) return next
      return {
        ...next,
        open: {
          ...open,
          tapping: tappingOn(open.draft.text.template, action.text),
          learnedFor: null,
        },
      }
    }
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
 * Whether the open rule's template answers what is tapped on screen. Until something is
 * tapped a text rule keeps the template it came with; once it is, only a template learned
 * from exactly those taps will do. A JSON rule has no template to wait for.
 */
export function templateCurrent(open: OpenRule): boolean {
  const text = open.draft.text
  if (!text) return true
  const mapping = open.tapping?.mapping
  const tapped = mapping ? Object.values(mapping.picks).some(Boolean) : false
  if (!mapping || !tapped) return text.template !== null
  const signature = signatureOf(learnRequestOf(mapping))
  return signature !== null && signature === open.learnedFor
}

/**
 * The set as it stands with the open rule's unsaved edits in place — what a dry run tries. A
 * new text rule with nothing learned yet cannot be sent, so it leaves the set until it can.
 */
export function workingSet(state: Pick<RuleEditorState, 'rules' | 'open'>): {
  rules: IntegrationRule[]
  focusIndex: number | null
} {
  const { open } = state
  const drafts = !open
    ? state.rules
    : open.isNew
      ? [...state.rules, open.draft]
      : state.rules.map((r, i) => (i === open.index ? open.draft : r))
  const rules: IntegrationRule[] = []
  let focusIndex: number | null = null
  drafts.forEach((draft, index) => {
    const wire = sendable(draft)
    if (!hasTemplate(wire)) return
    if (open && index === open.index) focusIndex = rules.length
    rules.push(wire)
  })
  return { rules, focusIndex }
}
