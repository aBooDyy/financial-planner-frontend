import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import type {
  CurrencyMode,
  DecimalStyle,
  EmailSample,
  ExtractField,
  FieldPick,
  LearnRequest,
  LearnResult,
  RuleFilter,
  SampleVerdict,
} from '#/features/email-sync/api/types'
import { learnRequestOf, signatureOf } from '#/features/email-sync/data/mapping'
import { saveRules } from '#/features/email-sync/data/mutations'
import { draftProblems, sameRules } from '#/features/email-sync/data/ruleDraft'
import type {
  DraftProblems,
  RuleDraft,
} from '#/features/email-sync/data/ruleDraft'
import {
  initialRuleEditorState,
  openRuleEdited,
  ruleEditorReducer,
  templateCurrent,
  workingSet,
} from '#/features/email-sync/data/ruleEditorState'
import type {
  OpenRule,
  RuleSettingsPatch,
} from '#/features/email-sync/data/ruleEditorState'
import {
  NO_PROBLEMS,
  ruleProblems,
} from '#/features/email-sync/data/ruleErrors'
import type { RuleProblems } from '#/features/email-sync/data/ruleErrors'
import { inboundImportsApi } from '#/features/inbound-imports/api/inboundImportsApi'
import { ApiError } from '#/lib/apiError'
import { useConfigLimits } from '#/lib/config/appConfig'
import type { CurrencyCode } from '#/lib/currency'
import { useDebouncedCall } from './useDebouncedCall'
import type { DebouncedCall } from './useDebouncedCall'

export type RuleTestRequest = {
  samples: EmailSample[]
  rules: ReturnType<typeof workingSet>['rules']
  focusIndex: number | null
}

export type EmailRuleEditorModel = {
  status: 'loading' | 'ready' | 'failed'
  rules: RuleDraft[]
  open: OpenRule | null
  /** The open rule's template answers what is picked on screen. */
  current: boolean
  /** What keeps the open rule from being done, if anything. */
  problems: DraftProblems
  learning: DebouncedCall<LearnResult>
  /** The learn answer for exactly the picks on screen, or null while there is none. */
  learned: LearnResult | null
  /** Why the picks on screen could not be learned, if they could not. */
  learnError: string | null
  testing: DebouncedCall<SampleVerdict[]>
  /** Where the open rule sits in the tested set; null while it cannot be tested yet. */
  testFocus: number | null
  saveProblems: RuleProblems
  /** The last save lost a race with another edit; only a reload can continue. */
  conflict: boolean
  dirty: boolean
  /** Closing the open rule without Done would lose edits. */
  ruleEdited: boolean
  saving: boolean
  rulesMax: number
  canAddRule: boolean
  /** A sample was asked for (Fix the rule) and could not be loaded. */
  sampleFailed: boolean
  reload: () => void
  add: () => void
  openRule: (index: number) => void
  closeRule: (commit: boolean) => void
  remove: (index: number) => void
  move: (from: number, to: number) => void
  toggleEnabled: (index: number) => void
  edit: (patch: RuleSettingsPatch) => void
  editFilter: (patch: Partial<RuleFilter>) => void
  chooseSample: (sample: EmailSample, similar: EmailSample[]) => void
  setTarget: (target: ExtractField | null) => void
  pick: (pick: FieldPick) => void
  /** Refine one field's pick without moving the target — which number on the line. */
  setPick: (field: ExtractField, pick: FieldPick) => void
  clearPick: (field: ExtractField) => void
  /** Makes the next tap on the sample name `field`'s label; null leaves that mode. */
  setLabelMode: (field: ExtractField | null) => void
  pickLabel: (line: number) => void
  /** Lets the server find `field`'s label again. */
  clearLabel: (field: ExtractField) => void
  setDecimal: (style: DecimalStyle) => void
  setCurrency: (mode: CurrencyMode, code: CurrencyCode | null) => void
  save: () => Promise<boolean>
}

type Options = {
  connectionId: string
  online: boolean
  /** The inbox's recent mail, as samples — what the open rule is tested against. */
  samples: EmailSample[]
  /** Open straight into a new rule once the set has loaded — right after connecting. */
  startWithNewRule?: boolean
  /** "Fix the rule": open this rule (else a new one) with the import's email as the sample. */
  fix?: { ruleId: string | null; importId: string }
}

const sampleFromImport = async (importId: string): Promise<EmailSample> => {
  const detail = await inboundImportsApi.getImport(importId)
  return {
    id: importId,
    senderEmail: detail.import.sourceRef ?? '',
    senderName: detail.import.sourceLabel,
    subject: detail.import.subject ?? '',
    bodyLines: detail.bodyLines,
  }
}

/**
 * The inbox's rules as one document: the draft set, the rule open in it, its mapping on a
 * sample, the debounced learn that turns picks into a template, the debounced test of the
 * working set against the inbox's mail, and the one PUT that saves. The transitions are the
 * pure reducer in `ruleEditorState`; this hook adds the effects.
 */
export function useEmailRuleEditor({
  connectionId,
  online,
  samples,
  startWithNewRule = false,
  fix,
}: Options): EmailRuleEditorModel {
  const [state, dispatch] = useReducer(
    ruleEditorReducer,
    undefined,
    initialRuleEditorState,
  )
  const limits = useConfigLimits()
  const [loads, setLoads] = useState(0)
  const [saving, setSaving] = useState(false)
  const [sampleFailed, setSampleFailed] = useState(false)
  const [failure, setFailure] = useState<{
    rules: RuleDraft[]
    problems: RuleProblems
    conflict: boolean
  } | null>(null)
  const opened = useRef(!startWithNewRule && !fix)

  useEffect(() => {
    let active = true
    emailSyncApi.getRules(connectionId).then(
      (set) => active && dispatch({ type: 'loaded', set }),
      () => active && dispatch({ type: 'failed' }),
    )
    return () => {
      active = false
    }
  }, [connectionId, loads])

  const fixRuleId = fix?.ruleId ?? null
  const fixImportId = fix?.importId ?? null
  useEffect(() => {
    if (state.status !== 'ready' || opened.current) return
    opened.current = true
    if (!fixImportId) {
      dispatch({ type: 'add' })
      return
    }
    dispatch({
      type: 'startFrom',
      ruleId: fixRuleId,
      rulesMax: limits.emailRulesMax,
    })
    sampleFromImport(fixImportId).then(
      (sample) => dispatch({ type: 'useSample', sample, similar: [] }),
      () => setSampleFailed(true),
    )
  }, [state.status, fixRuleId, fixImportId, limits.emailRulesMax])

  const open = state.open
  const mapping = open?.mapping ?? null
  const learnRequest = useMemo(
    () => (mapping ? learnRequestOf(mapping) : null),
    [mapping],
  )
  const learnCall = useCallback(
    (request: LearnRequest) => emailSyncApi.learn(connectionId, request),
    [connectionId],
  )
  const learning = useDebouncedCall(learnRequest, learnCall, online)
  const learnSignature = useMemo(
    () => signatureOf(learnRequest),
    [learnRequest],
  )
  const answersPicks =
    learnSignature !== null && learning.answered === learnSignature

  useEffect(() => {
    if (learning.result && learning.answered)
      dispatch({
        type: 'learned',
        signature: learning.answered,
        result: learning.result,
      })
  }, [learning.result, learning.answered])

  const working = useMemo(
    () => workingSet({ rules: state.rules, open: state.open }),
    [state.rules, state.open],
  )
  const testSamples = useMemo(
    () => samples.slice(0, limits.emailRuleSamplesMax),
    [samples, limits.emailRuleSamplesMax],
  )
  const ready = state.status === 'ready'
  const testRequest = useMemo<RuleTestRequest | null>(
    () =>
      ready && testSamples.length > 0 && working.rules.length > 0
        ? {
            samples: testSamples,
            rules: working.rules,
            focusIndex: working.focusIndex,
          }
        : null,
    [ready, testSamples, working],
  )
  const testCall = useCallback(
    (request: RuleTestRequest) =>
      emailSyncApi.test(
        connectionId,
        request.samples,
        request.rules,
        request.focusIndex ?? undefined,
      ),
    [connectionId],
  )
  const testing = useDebouncedCall(testRequest, testCall, online)

  const dirty = state.status === 'ready' && !sameRules(state.rules, state.saved)
  const ruleCount = state.rules.length + (open?.isNew ? 1 : 0)

  const save = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true
    if (saving || state.version === null) return false
    const drafts = workingSet({ rules: state.rules, open: null }).rules
    setSaving(true)
    setFailure(null)
    try {
      const set = await saveRules(connectionId, state.version, drafts)
      dispatch({ type: 'loaded', set })
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
  }, [dirty, saving, connectionId, state.version, state.rules])

  const shown = failure?.rules === state.rules ? failure : null

  return {
    status: state.status,
    rules: state.rules,
    open,
    current: open ? templateCurrent(open) : false,
    problems: open ? draftProblems(open.draft) : {},
    learning,
    learned: answersPicks ? learning.result : null,
    learnError: answersPicks ? learning.error : null,
    testing,
    testFocus: working.focusIndex,
    saveProblems: shown?.problems ?? NO_PROBLEMS,
    conflict: shown?.conflict ?? false,
    dirty,
    ruleEdited: openRuleEdited(state),
    saving,
    rulesMax: limits.emailRulesMax,
    canAddRule: ruleCount < limits.emailRulesMax,
    sampleFailed,
    reload: () => {
      setFailure(null)
      setLoads((n) => n + 1)
    },
    add: () => dispatch({ type: 'add' }),
    openRule: (index) => dispatch({ type: 'open', index }),
    closeRule: (commit) => dispatch({ type: 'close', commit }),
    remove: (index) => dispatch({ type: 'remove', index }),
    move: (from, to) => dispatch({ type: 'move', from, to }),
    toggleEnabled: (index) => dispatch({ type: 'toggleEnabled', index }),
    edit: (patch) => dispatch({ type: 'edit', patch }),
    editFilter: (patch) => dispatch({ type: 'editFilter', patch }),
    chooseSample: (sample, similar) =>
      dispatch({ type: 'useSample', sample, similar }),
    setTarget: (target) => dispatch({ type: 'target', target }),
    pick: (pick) => dispatch({ type: 'pick', pick }),
    setPick: (field, pick) => dispatch({ type: 'setPick', field, pick }),
    clearPick: (field) => dispatch({ type: 'clearPick', field }),
    setLabelMode: (field) => dispatch({ type: 'labelMode', field }),
    pickLabel: (line) => dispatch({ type: 'pickLabel', line }),
    clearLabel: (field) => dispatch({ type: 'clearLabel', field }),
    setDecimal: (style) => dispatch({ type: 'decimal', style }),
    setCurrency: (mode, code) => dispatch({ type: 'currency', mode, code }),
    save,
  }
}
