import { describe, expect, it } from 'vitest'
import type { RuleSet } from '#/features/integrations/api/ruleTypes'
import {
  buildTree,
  childPath,
  readSample,
  referenceCandidates,
  tokenId,
  visibleIds,
} from './payloadTree'
import { bindLocator, sendable } from './ruleDraft'
import type { Binding, RuleDraft } from './ruleDraft'
import {
  initialRuleEditorState,
  ruleEditorReducer,
  workingSet,
} from './ruleEditorState'
import type { RuleEditorAction, RuleEditorState } from './ruleEditorState'
import { ruleProblems } from './ruleErrors'
import { treeMarks } from './treeMarks'
import { guessDateFormat, suggestPattern } from './tokens'
import { nameRun, tokenise } from '#/lib/wordTokens'
import { ApiError } from '#/lib/apiError'

const SMS = 'SAR 152.75 spent at CARREFOUR on 23/09'
const smsTokens = tokenise(SMS)
const tokenIndex = (text: string) => smsTokens.findIndex((t) => t.text === text)

/** What a pattern captures in JS — the same constructs Python's `regex` reads alike. */
const capture = (pattern: string, text: string) =>
  new RegExp(pattern).exec(text)?.[1]

describe('tokens', () => {
  it('splits on spaces and trims punctuation around each piece', () => {
    expect(tokenise('Paid (SAR 10.00), thanks.').map((t) => t.text)).toEqual([
      'Paid',
      'SAR',
      '10.00',
      'thanks',
    ])
  })

  it.each([
    ['amount', '152.75', '152.75'],
    ['currency', 'SAR', 'SAR'],
    ['date', '23/09', '23/09'],
    ['merchant', 'CARREFOUR', 'CARREFOUR'],
  ] as const)(
    'writes a %s pattern for a tapped word of the Tasker SMS',
    (field, word, expected) => {
      const suggestion = suggestPattern(field, SMS, smsTokens, tokenIndex(word))
      expect(suggestion).not.toBeNull()
      expect(capture(suggestion!.regex, SMS)).toBe(expected)
    },
  )

  it('keeps a pattern general enough for the next message', () => {
    const regex = suggestPattern(
      'merchant',
      SMS,
      smsTokens,
      tokenIndex('CARREFOUR'),
    )!.regex
    expect(capture(regex, 'USD 9.00 spent at STARBUCKS on 01/10')).toBe(
      'STARBUCKS',
    )
  })

  it('grows a name over neighbouring words but stops at connectors', () => {
    const text = 'Purchase at CARREFOUR HYPER 4471 on 23/09'
    const tokens = tokenise(text)
    expect(nameRun(tokens, 2)).toEqual([2, 4])
    const regex = suggestPattern('merchant', text, tokens, 3)!.regex
    expect(capture(regex, text)).toBe('CARREFOUR HYPER 4471')
  })

  it('anchors on a neighbour when the shape alone would find the wrong number', () => {
    const text = 'Card 4471 charged 15.00 SAR'
    const tokens = tokenise(text)
    const suggestion = suggestPattern('amount', text, tokens, 3)!
    expect(capture(suggestion.regex, text)).toBe('15.00')
  })

  it.each([
    ['2026-09-23', 'ISO'],
    ['23/09', 'DMY'],
    ['09/23/2026', 'MDY'],
    ['2026/09/23', 'YMD'],
    ['1758621720', 'EPOCH_S'],
    [1758621720123, 'EPOCH_MS'],
  ] as const)('reads %s as %s', (value, format) => {
    expect(guessDateFormat(value)).toBe(format)
  })
})

describe('payload tree', () => {
  it('quotes a key the path grammar cannot take bare', () => {
    expect(childPath('$', 'amount')).toBe('$.amount')
    expect(childPath('$', 'amount.total')).toBe('$["amount.total"]')
    expect(childPath('$', 'say "hi"')).toBe('$["say \\"hi\\""]')
    expect(childPath('$.items', 0)).toBe('$.items[0]')
  })

  it('refuses what ingest would refuse', () => {
    expect(readSample('', 100)).toEqual({ ok: false, problem: 'empty' })
    expect(readSample('[1]', 100)).toMatchObject({ problem: 'not_object' })
    expect(readSample('{', 100)).toMatchObject({ problem: 'invalid' })
    expect(readSample('{"a": "xxxxxxxx"}', 10)).toMatchObject({
      problem: 'too_large',
    })
    expect(readSample('{"a": 1}', 100)).toEqual({
      ok: true,
      kind: 'json',
      value: { a: 1 },
    })
  })

  it('reads anything else as a text message, line by line like the server', () => {
    expect(readSample('[Bank] Paid SAR 10', 100)).toEqual({
      ok: true,
      kind: 'text',
      lines: ['[Bank] Paid SAR 10'],
    })
    expect(readSample('Paid\r\nSAR 10\rat X\n', 100)).toEqual({
      ok: true,
      kind: 'text',
      lines: ['Paid', 'SAR 10', 'at X', ''],
    })
  })

  it('lists open nodes and the words of an open string, never the root', () => {
    const root = buildTree({ text: SMS, items: [{ id: 'x' }] })
    const open = new Set(['$.text', '$.items'])
    expect(visibleIds(root, open)).toEqual([
      '$.text',
      ...smsTokens.map((_, i) => tokenId('$.text', i)),
      '$.items',
      '$.items[0]',
    ])
  })

  it('finds the leaves that look like a reference', () => {
    const root = buildTree({ id: 'evt_1', data: { txn_id: 9, amount: 1 } })
    expect(referenceCandidates(root)).toEqual(['$.id', '$.data.txn_id'])
  })
})

// --- The editor's state machine -----------------------------------------------------------

const loaded = (rules: RuleSet['rules'] = []): RuleEditorState =>
  ruleEditorReducer(initialRuleEditorState(), {
    type: 'loaded',
    set: { version: 'v1', rules },
  })

const run = (state: RuleEditorState, ...actions: RuleEditorAction[]) =>
  actions.reduce(ruleEditorReducer, state)

const leaf = (path: string, value: unknown): RuleEditorAction => ({
  type: 'bind',
  binding: { path, value },
})

const word = (text: string): Binding => ({
  path: '$.text',
  value: SMS,
  piece: { tokens: smsTokens, index: tokenIndex(text) },
})

describe('rule editor state', () => {
  it('hops amount → currency → date, then stops', () => {
    let state = run(loaded(), { type: 'add' })
    expect(state.target).toBe('amount')
    state = run(state, leaf('$.amount', '152.75'))
    expect(state.target).toBe('currency')
    state = run(state, leaf('$.currency', 'SAR'))
    expect(state.target).toBe('date')
    state = run(state, leaf('$.date', '2026-09-23'))
    expect(state.target).toBeNull()
    expect(state.open?.draft.fields.date).toEqual({
      path: '$.date',
      format: 'ISO',
    })
  })

  it('never lets an optional field take the target by itself', () => {
    let state = run(loaded(), { type: 'add' }, leaf('$.a', '1'))
    state = run(state, { type: 'target', target: 'merchant' })
    state = run(state, leaf('$.m', 'Shop'))
    expect(state.target).toBe('currency')
    state = run(state, leaf('$.c', 'SAR'), leaf('$.d', '2026-01-01'))
    expect(state.target).toBeNull()
  })

  it('fills four fields from four words of one SMS', () => {
    let state = run(loaded(), { type: 'add' })
    state = run(
      state,
      { type: 'bind', binding: word('152.75') },
      { type: 'bind', binding: word('SAR') },
      { type: 'bind', binding: word('23/09') },
      { type: 'target', target: 'merchant' },
      { type: 'bind', binding: word('CARREFOUR') },
    )
    const fields = state.open!.draft.fields
    expect(Object.keys(fields).sort()).toEqual([
      'amount',
      'currency',
      'date',
      'merchant',
    ])
    expect(fields.date?.format).toBe('DMY')
    for (const [field, expected] of [
      ['amount', '152.75'],
      ['currency', 'SAR'],
      ['date', '23/09'],
      ['merchant', 'CARREFOUR'],
    ] as const) {
      expect(capture(fields[field]!.regex!, SMS)).toBe(expected)
    }
  })

  it('binds a condition and moves on to the first empty field', () => {
    let state = run(
      loaded(),
      { type: 'add' },
      { type: 'target', target: 'match' },
    )
    state = run(state, leaf('$.event', 'purchase'))
    expect(state.open?.draft.match).toEqual({
      path: '$.event',
      op: 'EQUALS',
      value: 'purchase',
      ignoreCase: true,
    })
    expect(state.target).toBe('amount')
  })

  it('keeps a new rule out of the set until Done, and drops it on Cancel', () => {
    const cancelled = run(
      loaded(),
      { type: 'add' },
      { type: 'close', commit: false },
    )
    expect(cancelled.rules).toEqual([])
    const kept = run(loaded(), { type: 'add' }, { type: 'close', commit: true })
    expect(kept.rules.map((r) => r.name)).toEqual(['Rule 1'])
  })

  it('tries the open rule’s unsaved edits in place, with its position as the focus', () => {
    const state = run(
      loaded([
        { id: 'a', name: 'A', match: null, fields: {}, text: null },
        { id: 'b', name: 'B', match: null, fields: {}, text: null },
      ]),
      { type: 'open', index: 1 },
      { type: 'rename', name: 'B edited' },
    )
    const working = workingSet(state)
    expect(working.focusIndex).toBe(1)
    expect(working.rules.map((r) => r.name)).toEqual(['A', 'B edited'])
    expect(state.rules[1].name).toBe('B')
  })

  it('reorders the set, which is what decides the firing rule', () => {
    const state = run(
      loaded([
        { id: 'a', name: 'A', match: null, fields: {}, text: null },
        { id: 'b', name: 'B', match: null, fields: {}, text: null },
        { id: 'c', name: 'C', match: null, fields: {}, text: null },
      ]),
      { type: 'move', from: 2, to: 0 },
    )
    expect(workingSet(state).rules.map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('what is sent', () => {
  const draft = (fields: RuleDraft['fields']): RuleDraft => ({
    id: null,
    key: 'k',
    name: '  ',
    match: { path: ' ', op: 'EQUALS', value: '', ignoreCase: true },
    fields,
    text: null,
  })

  it('leaves out fields that point nowhere and an empty condition', () => {
    expect(
      sendable(
        draft({ amount: { path: '$.a' }, merchant: {}, note: { path: ' ' } }),
      ),
    ).toEqual({
      id: null,
      name: 'Untitled rule',
      match: null,
      fields: { amount: { path: '$.a' } },
      text: null,
    })
  })

  it('keeps the whole match when a pattern has no group', () => {
    const sent = sendable(
      draft({
        merchant: { path: '$.t', regex: '[A-Z]+' },
        note: { path: '$.t', regex: 'a(b)' },
      }),
    )
    expect(sent.fields.merchant?.group).toBe(0)
    expect(sent.fields.note?.group).toBe(1)
  })

  it('keeps the options a user set when a field is re-bound', () => {
    const next = bindLocator(
      'amount',
      { path: '$.old', unit: 'MINOR', regex: 'x(1)', group: 1 },
      { path: '$.new', value: 1500 },
    )
    expect(next).toEqual({ path: '$.new', unit: 'MINOR' })
  })

  it('starts a type map from the word that was tapped', () => {
    expect(
      bindLocator('type', undefined, { path: '$.d', value: 'debit' }),
    ).toEqual({
      path: '$.d',
      map: { debit: 'SPEND' },
    })
  })
})

describe('rule problems', () => {
  it('puts each 422 detail beside the rule and field it names', () => {
    const problems = ruleProblems(
      new ApiError({
        code: 'integrations.rule.regex_invalid',
        message: '',
        status: 422,
        details: [
          {
            field: 'rules[1].fields.merchant.regex',
            code: 'integrations.rule.regex_invalid',
          },
          {
            field: 'rules[0].match.path',
            code: 'integrations.rule.path_invalid',
          },
        ],
      }),
    )
    expect(problems.general).toBeNull()
    expect(problems.byRule.get(1)?.fields.merchant).toMatch(/pattern/)
    expect(problems.byRule.get(0)?.match).toMatch(/path/)
  })
})

describe('tree marks', () => {
  it('labels the words a pattern keeps, and the node a plain path reaches', () => {
    const tree = buildTree({ text: SMS, id: 'evt_1' })
    const marks = treeMarks(
      {
        match: null,
        fields: {
          merchant: { path: '$.text', regex: String.raw`at\s+(.+?)\s+on` },
          external_id: { path: '$.id' },
        },
      },
      tree,
    )
    expect(marks.get(tokenId('$.text', tokenIndex('CARREFOUR')))).toEqual([
      'Merchant',
    ])
    expect(marks.get('$.id')).toEqual(['Reference'])
    expect(marks.has('$.text')).toBe(false)
  })
})
