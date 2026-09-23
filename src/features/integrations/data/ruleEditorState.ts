import type {
  IntegrationRule,
  Locator,
  LocatorField,
  MatchCondition,
  RuleSet,
} from '#/features/integrations/api/ruleTypes'
import {
  bindLocator,
  bindMatch,
  firstTarget,
  newRule,
  nextTarget,
  sendable,
  toDraft,
} from './ruleDraft'
import type { Binding, RuleDraft } from './ruleDraft'

/** What a tap on the payload fills: one of the rule's fields, or its condition. */
export type Target = LocatorField | 'match'

export type OpenRule = {
  /** Where the rule sits (or will sit, for a new one) in the set. */
  index: number
  draft: RuleDraft
  isNew: boolean
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

export type RuleEditorAction =
  | { type: 'loaded'; set: RuleSet }
  | { type: 'failed' }
  | { type: 'add' }
  | { type: 'open'; index: number }
  | { type: 'close'; commit: boolean }
  | { type: 'remove'; index: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'rename'; name: string }
  | { type: 'setMatch'; match: MatchCondition | null }
  | { type: 'setLocator'; field: LocatorField; locator: Locator | null }
  | { type: 'target'; target: Target | null }
  | { type: 'bind'; binding: Binding }
  | { type: 'fixReference' }
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

const withDraft = (
  state: RuleEditorState,
  change: (draft: RuleDraft) => RuleDraft,
): RuleEditorState =>
  state.open
    ? { ...state, open: { ...state.open, draft: change(state.open.draft) } }
    : state

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
      const draft = newRule(state.rules.length)
      return {
        ...state,
        open: { index: state.rules.length, draft, isNew: true },
        target: firstTarget(draft.fields),
        highlightReference: false,
      }
    }
    case 'open': {
      if (action.index < 0 || action.index >= state.rules.length) return state
      const draft = state.rules[action.index]
      return {
        ...state,
        open: { index: action.index, draft, isNew: false },
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
    case 'setMatch':
      return withDraft(state, (d) => ({ ...d, match: action.match }))
    case 'setLocator':
      return withDraft(state, (d) => setField(d, action.field, action.locator))
    case 'target':
      return { ...state, target: action.target }
    case 'bind': {
      const { open, target } = state
      if (!open || !target) return state
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
    case 'sample':
      return { ...state, sample: action.text }
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

/** The set as it stands with the open rule's unsaved edits in place — what a dry run tries. */
export function workingSet(state: Pick<RuleEditorState, 'rules' | 'open'>): {
  rules: IntegrationRule[]
  focusIndex: number | null
} {
  const { open } = state
  if (!open) return { rules: state.rules.map(sendable), focusIndex: null }
  const rules = open.isNew
    ? [...state.rules, open.draft]
    : state.rules.map((r, i) => (i === open.index ? open.draft : r))
  return { rules: rules.map(sendable), focusIndex: open.index }
}
