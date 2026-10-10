import { describe, expect, it } from 'vitest'
import {
  hasTemplate,
  toRuleSet,
  toRuleWire,
} from '#/features/integrations/api/ruleTypes'
import type {
  IntegrationRule,
  RuleSet,
} from '#/features/integrations/api/ruleTypes'
import { ApiError } from '#/lib/apiError'
import type {
  ExtractionTemplate,
  Learned,
} from '#/features/text-templates/api/types'
import {
  learnRequestOf,
  signatureOf,
} from '#/features/text-templates/data/mapping'
import { messageFields } from './messageFields'
import { describeTextFilter, sendable } from './ruleDraft'
import {
  guessTextPath,
  initialRuleEditorState,
  ruleEditorReducer,
  templateCurrent,
  textSampleOf,
  workingSet,
} from './ruleEditorState'
import type { RuleEditorAction, RuleEditorState } from './ruleEditorState'
import { ruleProblems } from './ruleErrors'

const SMS = 'Purchase of SAR 38.50\nat CARREFOUR\nCard **1123'
const WRAPPED = JSON.stringify({
  sender: 'MyBank',
  data: { message: SMS, sent: '2026-10-10' },
})

const TEMPLATE: ExtractionTemplate = {
  kind: 'anchored_lines',
  amount: { label: null, numberIndex: null, decimal: 'auto' },
  currency: { mode: 'from_email', label: null, code: 'SAR' },
  merchant: { label: { text: 'at', offset: 0 } },
}

const TEXT_RULE: IntegrationRule = {
  id: 't1',
  name: 'Bank SMS',
  match: null,
  fields: {},
  text: {
    textPath: null,
    filter: { textAny: ['purchase'], excludeAny: ['otp'] },
    template: TEMPLATE,
    walletId: 'w1',
    type: 'spend',
    categoryId: 'c1',
    defaultMerchant: '',
  },
}

const JSON_RULE: IntegrationRule = {
  id: 'j1',
  name: 'Webhook',
  match: null,
  fields: {},
  text: null,
}

const loaded = (rules: RuleSet['rules'] = [], sample = ''): RuleEditorState =>
  ruleEditorReducer(initialRuleEditorState(sample), {
    type: 'loaded',
    set: { version: 'v1', rules },
  })

const run = (state: RuleEditorState, ...actions: RuleEditorAction[]) =>
  actions.reduce(ruleEditorReducer, state)

const tap = (action: Extract<RuleEditorAction, { type: 'tap' }>['action']) =>
  ({ type: 'tap', action }) as const

const learned = (state: RuleEditorState): RuleEditorAction => {
  const mapping = state.open?.tapping?.mapping
  const signature = mapping ? signatureOf(learnRequestOf(mapping)) : null
  const result: Learned = {
    template: TEMPLATE,
    reading: {
      amount: 3850,
      currency: 'SAR',
      merchant: 'CARREFOUR',
      complete: true,
      fields: {
        amount: { status: 'ok', raw: '38.50', line: 0 },
        currency: { status: 'ok', raw: 'SAR', line: 0 },
        merchant: { status: 'ok', raw: 'CARREFOUR', line: 1 },
      },
    },
    labels: { amount: null, currency: null, merchant: null },
  }
  return { type: 'learned', signature: signature ?? '', result }
}

describe('text rules on the wire', () => {
  it('reads a text rule and sends it back as one', () => {
    const set = toRuleSet({
      version: 'v1',
      rules: [
        {
          id: 't1',
          position: 0,
          name: 'Bank SMS',
          kind: 'TEXT',
          match: null,
          fields: {},
          filter: { text_any: ['purchase'], exclude_any: ['otp'] },
          template: {
            kind: 'anchored_lines',
            amount: { label: null, number_index: null, decimal: 'AUTO' },
            currency: { mode: 'FROM_EMAIL', label: null, code: 'SAR' },
            merchant: { label: { text: 'at', offset: 0 } },
          },
          wallet_id: 'w1',
          type: 'SPEND',
          category_id: 'c1',
          default_merchant: null,
        },
        { id: 'j1', position: 1, name: 'Webhook', match: null, fields: {} },
      ],
    })
    expect(set.rules).toEqual([TEXT_RULE, JSON_RULE])
    expect(toRuleWire(TEXT_RULE)).toEqual({
      id: 't1',
      name: 'Bank SMS',
      kind: 'TEXT',
      text_path: null,
      filter: { text_any: ['purchase'], exclude_any: ['otp'] },
      template: {
        kind: 'anchored_lines',
        amount: { label: null, number_index: null, decimal: 'AUTO' },
        currency: { mode: 'FROM_EMAIL', label: null, code: 'SAR' },
        merchant: { label: { text: 'at', offset: 0 } },
      },
      wallet_id: 'w1',
      type: 'SPEND',
      category_id: 'c1',
      default_merchant: null,
    })
    expect(toRuleWire(JSON_RULE)).toMatchObject({ kind: 'JSON' })
  })

  it('cannot send a text rule before a template is learned', () => {
    const blank = { ...TEXT_RULE, text: { ...TEXT_RULE.text!, template: null } }
    expect(hasTemplate(blank)).toBe(false)
    expect(hasTemplate(TEXT_RULE)).toBe(true)
    expect(() => toRuleWire(blank)).toThrow()
  })

  it('cleans the filter and the default merchant before sending', () => {
    const sent = sendable({
      ...TEXT_RULE,
      key: 'k',
      name: ' ',
      text: {
        ...TEXT_RULE.text!,
        filter: { textAny: [' Purchase ', 'purchase', ''], excludeAny: [] },
        defaultMerchant: '  Card  ',
      },
    })
    expect(sent.name).toBe('Untitled rule')
    expect(sent.text?.filter.textAny).toEqual(['Purchase'])
    expect(sent.text?.defaultMerchant).toBe('Card')
  })

  it('describes a filter in words', () => {
    expect(describeTextFilter({ textAny: [], excludeAny: [] })).toBe(
      'Any text message',
    )
    expect(
      describeTextFilter({
        textAny: ['purchase', 'شراء'],
        excludeAny: ['otp'],
      }),
    ).toBe('Text messages with “purchase” or “شراء” · not “otp”')
    expect(
      describeTextFilter({ textAny: ['purchase'], excludeAny: [] }, '$.body'),
    ).toBe('Messages in $.body with “purchase”')
    expect(describeTextFilter({ textAny: [], excludeAny: [] }, '$.body')).toBe(
      'Any message in $.body',
    )
  })

  it('carries where a JSON payload holds the message', () => {
    const [rule] = toRuleSet({
      version: 'v1',
      rules: [
        {
          id: 't1',
          position: 0,
          name: 'Wrapped SMS',
          kind: 'TEXT',
          match: null,
          fields: {},
          text_path: '$.data.message',
          filter: { text_any: [], exclude_any: [] },
          template: null,
        },
      ],
    }).rules
    expect(rule.text?.textPath).toBe('$.data.message')
    expect(
      toRuleWire({ ...rule, text: { ...rule.text!, template: TEMPLATE } }),
    ).toMatchObject({ text_path: '$.data.message' })
  })
})

describe('a message inside a JSON payload', () => {
  it('lists the payload’s strings, the likeliest message first', () => {
    expect(messageFields(JSON.parse(WRAPPED))).toEqual([
      { path: '$.data.message', text: SMS },
      { path: '$.data.sent', text: '2026-10-10' },
      { path: '$.sender', text: 'MyBank' },
    ])
    expect(guessTextPath(WRAPPED)).toBe('$.data.message')
    expect(guessTextPath(SMS)).toBeNull()
  })

  it('taps the text at the rule’s path, and only in JSON', () => {
    expect(textSampleOf(WRAPPED, '$.data.message')?.bodyLines).toEqual([
      'Purchase of SAR 38.50',
      'at CARREFOUR',
      'Card **1123',
    ])
    expect(textSampleOf(WRAPPED, '$.missing')).toBeNull()
    expect(textSampleOf(WRAPPED, '$.data')).toBeNull()
    expect(textSampleOf(SMS, '$.data.message')).toBeNull()
  })

  it('points a new text rule at the likeliest field of a JSON sample', () => {
    const state = run(
      loaded([], WRAPPED),
      { type: 'add' },
      { type: 'kind', kind: 'text' },
    )
    expect(state.open?.draft.text?.textPath).toBe('$.data.message')
    expect(state.open?.tapping?.mapping.sample?.bodyLines).toHaveLength(3)
  })

  it('re-reads the taps when the field changes', () => {
    const state = run(
      loaded([], WRAPPED),
      { type: 'add', kind: 'text' },
      tap({ type: 'pick', pick: { line: 0, start: 16, end: 21 } }),
      { type: 'textPath', path: '$.sender' },
    )
    expect(state.open?.draft.text?.textPath).toBe('$.sender')
    expect(state.open?.tapping?.mapping.picks.amount).toBeNull()
    expect(state.open?.tapping?.mapping.sample?.bodyLines).toEqual(['MyBank'])
  })

  it('follows a new rule’s sample to its message, but not a saved rule’s', () => {
    const fresh = run(
      loaded([], SMS),
      { type: 'add' },
      {
        type: 'sample',
        text: WRAPPED,
      },
    )
    expect(fresh.open?.draft.text?.textPath).toBe('$.data.message')
    const back = run(fresh, { type: 'sample', text: SMS })
    expect(back.open?.draft.text?.textPath).toBeNull()

    const saved = run(
      loaded([
        { ...TEXT_RULE, text: { ...TEXT_RULE.text!, textPath: '$.body' } },
      ]),
      { type: 'open', index: 0 },
      { type: 'sample', text: WRAPPED },
    )
    expect(saved.open?.draft.text?.textPath).toBe('$.body')
    expect(saved.open?.tapping?.mapping.sample).toBeNull()
  })

  it('puts a refused path beside its control', () => {
    const problems = ruleProblems(
      new ApiError({
        status: 422,
        code: 'integrations.rule.path_invalid',
        message: 'x',
        details: [
          {
            field: 'rules[0].text_path',
            code: 'integrations.rule.path_invalid',
          },
        ],
      }),
    )
    expect(problems.byRule.get(0)?.textPath).toBeTruthy()
  })
})

describe('the text rule editor', () => {
  it('reads a sample that is not JSON as a message', () => {
    expect(textSampleOf(SMS)?.bodyLines).toEqual([
      'Purchase of SAR 38.50',
      'at CARREFOUR',
      'Card **1123',
    ])
    expect(textSampleOf('{"a": 1}')).toBeNull()
    expect(textSampleOf('  ')).toBeNull()
  })

  it('adds a text rule when the sample is a message, a JSON rule otherwise', () => {
    const onText = run(loaded([], SMS), { type: 'add' })
    expect(onText.open?.draft.text).not.toBeNull()
    expect(onText.open?.tapping?.mapping.sample?.bodyLines).toHaveLength(3)
    expect(onText.open?.tapping?.target).toBe('amount')

    const onJson = run(loaded([], '{"a": 1}'), { type: 'add' })
    expect(onJson.open?.draft.text).toBeNull()
    expect(onJson.open?.tapping).toBeNull()
  })

  it('lets a new rule change kind, and only a new one', () => {
    const switched = run(
      loaded([], SMS),
      { type: 'add' },
      {
        type: 'kind',
        kind: 'json',
      },
    )
    expect(switched.open?.draft.text).toBeNull()
    const back = run(switched, { type: 'kind', kind: 'text' })
    expect(back.open?.draft.text?.template).toBeNull()

    const saved = run(
      loaded([TEXT_RULE], SMS),
      { type: 'open', index: 0 },
      {
        type: 'kind',
        kind: 'json',
      },
    )
    expect(saved.open?.draft.text).not.toBeNull()
  })

  it('takes a learned template only for the taps it answers', () => {
    const tapped = run(
      loaded([], SMS),
      { type: 'add' },
      tap({ type: 'pick', pick: { line: 0, start: 16, end: 21 } }),
      tap({ type: 'pick', pick: { line: 0, start: 12, end: 15 } }),
    )
    expect(tapped.open && templateCurrent(tapped.open)).toBe(false)
    const answer = learned(tapped)

    const stale = run(tapped, tap({ type: 'decimal', style: 'comma' }), answer)
    expect(stale.open?.draft.text?.template).toBeNull()

    const current = run(tapped, answer)
    expect(current.open?.draft.text?.template).toEqual(TEMPLATE)
    expect(current.open && templateCurrent(current.open)).toBe(true)
  })

  it('keeps a saved rule’s template until something is tapped', () => {
    const opened = run(loaded([TEXT_RULE], SMS), { type: 'open', index: 0 })
    expect(opened.open && templateCurrent(opened.open)).toBe(true)
    const retapped = run(
      opened,
      tap({ type: 'pick', pick: { line: 0, start: 16, end: 21 } }),
    )
    expect(retapped.open && templateCurrent(retapped.open)).toBe(false)
  })

  it('drops the taps when the sample changes', () => {
    const state = run(
      loaded([], SMS),
      { type: 'add' },
      tap({ type: 'pick', pick: { line: 0, start: 16, end: 21 } }),
      { type: 'sample', text: 'Refund of SAR 5' },
    )
    expect(state.open?.tapping?.mapping.picks.amount).toBeNull()
    expect(state.open?.tapping?.mapping.sample?.bodyLines).toEqual([
      'Refund of SAR 5',
    ])
  })

  it('clears the category when the type changes, and cleans filter terms', () => {
    const state = run(
      loaded([TEXT_RULE]),
      { type: 'open', index: 0 },
      { type: 'editText', patch: { type: 'income' } },
      { type: 'textFilter', patch: { textAny: [' refund', 'Refund'] } },
    )
    expect(state.open?.draft.text?.categoryId).toBeNull()
    expect(state.open?.draft.text?.filter.textAny).toEqual(['refund'])
  })

  it('leaves a new text rule out of the tested set until it has a template', () => {
    const state = run(loaded([JSON_RULE], SMS), { type: 'add' })
    expect(workingSet(state)).toEqual({ rules: [JSON_RULE], focusIndex: null })
  })

  it('puts a refused text rule part beside its control', () => {
    const problems = ruleProblems(
      new ApiError({
        status: 422,
        code: 'integrations.rule.wallet_invalid',
        message: 'x',
        details: [
          {
            field: 'rules[1].wallet_id',
            code: 'integrations.rule.wallet_invalid',
          },
          {
            field: 'rules[1].filter.text_any',
            code: 'integrations.rule.term_invalid',
          },
          {
            field: 'rules[1].template.currency.code',
            code: 'integrations.rule.currency_invalid',
          },
        ],
      }),
    )
    const problem = problems.byRule.get(1)
    expect(problem?.walletId).toBeTruthy()
    expect(problem?.filter).toBeTruthy()
    expect(problem?.template).toBeTruthy()
    expect(problems.general).toBeNull()
  })
})
