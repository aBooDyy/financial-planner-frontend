import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { integrationRulesApi } from '#/features/integrations/api/integrationRulesApi'
import { recordRuleCount } from '#/features/integrations/data/cache'
import type {
  Locator,
  LocatorField,
  MatchCondition,
} from '#/features/integrations/api/ruleTypes'
import {
  importPayload,
  lastPayload,
} from '#/features/integrations/data/lastPayload'
import { buildTree, readSample } from '#/features/integrations/data/payloadTree'
import type {
  PayloadNode,
  SampleReading,
} from '#/features/integrations/data/payloadTree'
import { prettyJson } from '#/features/integrations/data/prettyJson'
import { sameRules, sendable } from '#/features/integrations/data/ruleDraft'
import type { Binding, RuleDraft } from '#/features/integrations/data/ruleDraft'
import {
  initialRuleEditorState,
  ruleEditorReducer,
  workingSet,
} from '#/features/integrations/data/ruleEditorState'
import type {
  OpenRule,
  Target,
} from '#/features/integrations/data/ruleEditorState'
import {
  NO_PROBLEMS,
  ruleProblems,
} from '#/features/integrations/data/ruleErrors'
import type { RuleProblems } from '#/features/integrations/data/ruleErrors'
import { ApiError } from '#/lib/apiError'
import { useConfigLimits } from '#/lib/config/appConfig'
import { useDryRun } from './useDryRun'
import type { DryRunState } from './useDryRun'

export type LastPayloadState = 'idle' | 'loading' | 'none' | 'failed'

export type RuleEditorModel = {
  status: 'loading' | 'ready' | 'failed'
  rules: RuleDraft[]
  open: OpenRule | null
  target: Target | null
  highlightReference: boolean
  sample: string
  reading: SampleReading
  tree: PayloadNode | null
  dryRun: DryRunState
  /** Problems from the last save, by rule position — until the set changes again. */
  saveProblems: RuleProblems
  /** The last save lost a race with another edit; only a reload can continue. */
  conflict: boolean
  dirty: boolean
  /** The open rule has edits that Done has not folded into the set yet. */
  openDirty: boolean
  saving: boolean
  rulesMax: number
  canAddRule: boolean
  lastPayload: LastPayloadState
  reload: () => void
  add: () => void
  openRule: (index: number) => void
  closeRule: (commit: boolean) => void
  remove: (index: number) => void
  move: (from: number, to: number) => void
  rename: (name: string) => void
  setMatch: (match: MatchCondition | null) => void
  setLocator: (field: LocatorField, locator: Locator | null) => void
  setTarget: (target: Target | null) => void
  bind: (binding: Binding) => void
  fixReference: () => void
  setSample: (text: string) => void
  loadLastPayload: () => Promise<void>
  /**
   * Make this payload the sample and open the rule it is about: the one that handled it, else
   * a new rule (or the first, when the set is full).
   */
  startFromPayload: (text: string, ruleId: string | null) => void
  /** Replace the saved set with this one. True when there was nothing to save or it saved. */
  save: () => Promise<boolean>
}

type Options = {
  keyId: string
  online: boolean
  /** Open straight into a new rule once the (empty) set has loaded — the create flow. */
  startWithNewRule?: boolean
  /**
   * A staged import whose payload should be the sample — "Fix the rule" from the review
   * queue. The first rule opens on it, or a new one when the key has none.
   */
  sampleImportId?: string
}

/**
 * The rule editor's whole state machine: the draft set and the rule open in it, the field a
 * tap fills and where it hops next, the sample payload, the debounced dry run, and the one PUT
 * that saves the set. The transitions are the pure reducer in `ruleEditorState`; this hook adds
 * the effects — loading, testing, saving.
 */
export function useRuleEditor({
  keyId,
  online,
  startWithNewRule = false,
  sampleImportId,
}: Options): RuleEditorModel {
  const [state, dispatch] = useReducer(
    ruleEditorReducer,
    '',
    initialRuleEditorState,
  )
  const limits = useConfigLimits()
  const [loads, setLoads] = useState(0)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<{
    rules: RuleDraft[]
    problems: RuleProblems
    conflict: boolean
  } | null>(null)
  const [lastState, setLastState] = useState<LastPayloadState>('idle')
  const opened = useRef(!startWithNewRule && !sampleImportId)

  useEffect(() => {
    let active = true
    integrationRulesApi.list(keyId).then(
      (set) => active && dispatch({ type: 'loaded', set }),
      () => active && dispatch({ type: 'failed' }),
    )
    return () => {
      active = false
    }
  }, [keyId, loads])

  useEffect(() => {
    if (state.status !== 'ready' || opened.current) return
    opened.current = true
    if (state.rules.length === 0) dispatch({ type: 'add' })
    else if (sampleImportId) dispatch({ type: 'open', index: 0 })
  }, [state.status, state.rules.length, sampleImportId])

  useEffect(() => {
    if (!sampleImportId) return
    let active = true
    importPayload(sampleImportId).then(
      (text) => {
        if (active && text) dispatch({ type: 'sample', text: prettyJson(text) })
      },
      () => active && setLastState('failed'),
    )
    return () => {
      active = false
    }
  }, [sampleImportId])

  const reading = useMemo(
    () => readSample(state.sample, limits.integrationPayloadMaxBytes),
    [state.sample, limits.integrationPayloadMaxBytes],
  )
  const tree = useMemo(
    () => (reading.ok ? buildTree(reading.value) : null),
    [reading],
  )

  const working = useMemo(
    () => workingSet({ rules: state.rules, open: state.open }),
    [state.rules, state.open],
  )
  const dryRun = useDryRun(
    {
      keyId,
      payload: reading.ok ? state.sample : null,
      rules: working.rules,
      focusIndex: working.focusIndex,
    },
    online && state.status === 'ready',
  )

  const dirty = state.status === 'ready' && !sameRules(state.rules, state.saved)
  const openDirty =
    state.open !== null && !sameRules([state.open.draft], [state.open.base])
  const ruleCount = state.rules.length + (state.open?.isNew ? 1 : 0)

  const save = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true
    if (saving || state.version === null) return false
    setSaving(true)
    setFailure(null)
    try {
      const set = await integrationRulesApi.replace(
        keyId,
        state.version,
        state.rules.map(sendable),
      )
      dispatch({ type: 'loaded', set })
      await recordRuleCount(keyId, set.rules.length)
      return true
    } catch (error) {
      setFailure({
        rules: state.rules,
        problems: ruleProblems(error),
        conflict: error instanceof ApiError && error.status === 409,
      })
      return false
    } finally {
      setSaving(false)
    }
  }, [dirty, saving, keyId, state.version, state.rules])

  const current = failure?.rules === state.rules ? failure : null
  const canAddRule = ruleCount < limits.integrationRulesMax

  const startFromPayload = (text: string, ruleId: string | null) => {
    setLastState('idle')
    dispatch({ type: 'sample', text: prettyJson(text) })
    dispatch({
      type: 'startFrom',
      ruleId,
      rulesMax: limits.integrationRulesMax,
    })
  }

  const loadLastPayload = useCallback(async () => {
    setLastState('loading')
    try {
      const text = await lastPayload(keyId)
      if (text) {
        dispatch({ type: 'sample', text: prettyJson(text) })
        setLastState('idle')
      } else {
        setLastState('none')
      }
    } catch {
      setLastState('failed')
    }
  }, [keyId])

  return {
    status: state.status,
    rules: state.rules,
    open: state.open,
    target: state.target,
    highlightReference: state.highlightReference,
    sample: state.sample,
    reading,
    tree,
    dryRun,
    saveProblems: current?.problems ?? NO_PROBLEMS,
    conflict: current?.conflict ?? false,
    dirty,
    openDirty,
    saving,
    rulesMax: limits.integrationRulesMax,
    canAddRule,
    lastPayload: lastState,
    reload: () => {
      setFailure(null)
      setLoads((n) => n + 1)
    },
    add: () => dispatch({ type: 'add' }),
    openRule: (index) => dispatch({ type: 'open', index }),
    closeRule: (commit) => dispatch({ type: 'close', commit }),
    remove: (index) => dispatch({ type: 'remove', index }),
    move: (from, to) => dispatch({ type: 'move', from, to }),
    rename: (name) => dispatch({ type: 'rename', name }),
    setMatch: (match) => dispatch({ type: 'setMatch', match }),
    setLocator: (field, locator) =>
      dispatch({ type: 'setLocator', field, locator }),
    setTarget: (target) => dispatch({ type: 'target', target }),
    bind: (binding) => dispatch({ type: 'bind', binding }),
    fixReference: () => dispatch({ type: 'fixReference' }),
    setSample: (text) => {
      setLastState('idle')
      dispatch({ type: 'sample', text })
    },
    loadLastPayload,
    startFromPayload,
    save,
  }
}
