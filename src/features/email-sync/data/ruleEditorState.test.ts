import { describe, expect, it } from 'vitest'
import type {
  EmailRule,
  EmailSample,
  ExtractionTemplate,
  LearnResult,
} from '#/features/email-sync/api/types'
import { learnRequestOf, pickForLine, signatureOf } from './mapping'
import { describeFilter, sendable } from './ruleDraft'
import {
  initialRuleEditorState,
  openRuleEdited,
  ruleEditorReducer,
  templateCurrent,
  workingSet,
} from './ruleEditorState'
import type { RuleEditorAction, RuleEditorState } from './ruleEditorState'

const TEMPLATE: ExtractionTemplate = {
  kind: 'anchored_lines',
  amount: { anchor: 'amount', numberIndex: null, decimal: 'auto' },
  currency: { mode: 'from_email', anchor: 'amount', code: 'SAR' },
  merchant: null,
}

const rule = (id: string, over: Partial<EmailRule> = {}): EmailRule => ({
  id,
  position: 0,
  name: `Rule ${id}`,
  enabled: true,
  filter: {
    senders: ['alerts@bank.com'],
    subjectAny: [],
    bodyAny: [],
    excludeAny: [],
  },
  template: TEMPLATE,
  walletId: null,
  type: 'spend',
  category: null,
  subcategory: null,
  autoConfirm: false,
  createdAt: '',
  updatedAt: '',
  version: 'v',
  ...over,
})

const SAMPLE: EmailSample = {
  id: 'm1',
  senderEmail: 'Alerts@Bank.com',
  senderName: 'Al Bank',
  subject: 'Purchase',
  bodyLines: ['Dear customer', 'Amount: SAR 38.50 card 4471', 'At: Jarir'],
}

const run = (...actions: RuleEditorAction[]): RuleEditorState =>
  actions.reduce(ruleEditorReducer, initialRuleEditorState())

const loaded = (...rules: EmailRule[]): RuleEditorAction => ({
  type: 'loaded',
  set: { version: 'set-1', rules },
})

const learnResult = (over: Partial<LearnResult> = {}): LearnResult => ({
  template: { ...TEMPLATE, amount: { ...TEMPLATE.amount, decimal: 'dot' } },
  reading: {
    amount: 3850,
    currency: 'SAR',
    merchant: null,
    complete: true,
    fields: {
      amount: { status: 'ok', raw: '38.50', line: 1 },
      currency: { status: 'ok', raw: 'SAR', line: 1 },
      merchant: { status: 'not_set', raw: null, line: null },
    },
  },
  similar: [],
  suggestedFilter: {
    senders: ['alerts@bank.com'],
    subjectAny: ['Purchase'],
    bodyAny: [],
    excludeAny: [],
  },
  ...over,
})

describe('ruleEditorReducer — a new rule from a sample', () => {
  it('seeds the sender and the name from the sample, and targets the amount', () => {
    const state = run(
      loaded(),
      { type: 'add' },
      {
        type: 'useSample',
        sample: SAMPLE,
        similar: [],
      },
    )
    expect(state.open?.draft.filter.senders).toEqual(['alerts@bank.com'])
    expect(state.open?.draft.name).toBe('Al Bank')
    expect(state.open?.target).toBe('amount')
  })

  it('hops from the amount to the currency, then to nothing', () => {
    const line = SAMPLE.bodyLines[1]
    let state = run(
      loaded(),
      { type: 'add' },
      {
        type: 'useSample',
        sample: SAMPLE,
        similar: [],
      },
    )
    state = ruleEditorReducer(state, {
      type: 'pick',
      pick: pickForLine(line, 1, 'amount'),
    })
    expect(state.open?.mapping.picks.amount).toEqual({ line: 1 })
    expect(state.open?.target).toBe('currency')
    state = ruleEditorReducer(state, { type: 'pick', pick: { line: 1 } })
    expect(state.open?.target).toBeNull()
    expect(learnRequestOf(state.open!.mapping)).not.toBeNull()
  })

  it('pins the amount by span when its line has one number', () => {
    expect(pickForLine('Total: 38.50', 0, 'amount')).toEqual({
      line: 0,
      start: 7,
      end: 12,
    })
    expect(pickForLine('Total: 38.50', 0, 'currency')).toEqual({ line: 0 })
  })

  it('never needs a currency pick for a fixed currency', () => {
    let state = run(
      loaded(),
      { type: 'add' },
      {
        type: 'useSample',
        sample: SAMPLE,
        similar: [],
      },
    )
    state = ruleEditorReducer(state, {
      type: 'currency',
      mode: 'fixed',
      code: 'KWD',
    })
    state = ruleEditorReducer(state, { type: 'pick', pick: { line: 1 } })
    expect(state.open?.target).toBeNull()
    const request = learnRequestOf(state.open!.mapping)
    expect(request?.picks.currency).toBeNull()
    expect(request?.options.currency).toEqual({ mode: 'fixed', code: 'KWD' })
  })

  it('takes a learned template only for the picks it answers', () => {
    let state = run(
      loaded(),
      { type: 'add' },
      { type: 'useSample', sample: SAMPLE, similar: [] },
      { type: 'pick', pick: { line: 1 } },
      { type: 'pick', pick: { line: 1 } },
    )
    const signature = signatureOf(learnRequestOf(state.open!.mapping))!
    expect(templateCurrent(state.open!)).toBe(false)

    const stale = ruleEditorReducer(state, {
      type: 'learned',
      signature: 'something else',
      result: learnResult(),
    })
    expect(stale.open?.draft.template).toBeNull()

    state = ruleEditorReducer(state, {
      type: 'learned',
      signature,
      result: learnResult(),
    })
    expect(state.open?.draft.template?.amount.decimal).toBe('dot')
    expect(state.open?.draft.filter.subjectAny).toEqual(['Purchase'])
    expect(templateCurrent(state.open!)).toBe(true)

    state = ruleEditorReducer(state, { type: 'decimal', style: 'comma' })
    expect(templateCurrent(state.open!)).toBe(false)
  })

  it('stops adopting suggestions once the user edits the filter', () => {
    let state = run(
      loaded(),
      { type: 'add' },
      { type: 'useSample', sample: SAMPLE, similar: [] },
      { type: 'editFilter', patch: { excludeAny: [' OTP ', 'otp', ''] } },
      { type: 'pick', pick: { line: 1 } },
      { type: 'pick', pick: { line: 1 } },
    )
    expect(state.open?.draft.filter.excludeAny).toEqual(['OTP'])
    const signature = signatureOf(learnRequestOf(state.open!.mapping))!
    state = ruleEditorReducer(state, {
      type: 'learned',
      signature,
      result: learnResult(),
    })
    expect(state.open?.draft.filter.subjectAny).toEqual([])
  })
})

describe('ruleEditorReducer — the set', () => {
  it('adds a new rule only on Done', () => {
    const cancelled = run(
      loaded(rule('r1')),
      { type: 'add' },
      {
        type: 'close',
        commit: false,
      },
    )
    expect(cancelled.rules).toHaveLength(1)

    const done = run(
      loaded(rule('r1')),
      { type: 'add' },
      { type: 'edit', patch: { name: 'Refunds' } },
      { type: 'close', commit: true },
    )
    expect(done.rules.map((r) => r.name)).toEqual(['Rule r1', 'Refunds'])
  })

  it('keeps an opened rule’s template until a sample is mapped', () => {
    const state = run(loaded(rule('r1')), { type: 'open', index: 0 })
    expect(templateCurrent(state.open!)).toBe(true)
    expect(state.open?.mapping.options.currency.mode).toBe('from_email')
  })

  it('reorders, pauses and removes', () => {
    let state = run(loaded(rule('r1'), rule('r2'), rule('r3')))
    state = ruleEditorReducer(state, { type: 'move', from: 2, to: 0 })
    expect(state.rules.map((r) => r.id)).toEqual(['r3', 'r1', 'r2'])
    state = ruleEditorReducer(state, { type: 'toggleEnabled', index: 1 })
    expect(state.rules[1].enabled).toBe(false)
    state = ruleEditorReducer(state, { type: 'remove', index: 0 })
    expect(state.rules.map((r) => r.id)).toEqual(['r1', 'r2'])
  })

  it('clears auto-confirm with the account, and the category with the type', () => {
    const state = run(
      loaded(
        rule('r1', { walletId: 'w1', autoConfirm: true, category: 'food' }),
      ),
      { type: 'open', index: 0 },
      { type: 'edit', patch: { walletId: null } },
      { type: 'edit', patch: { type: 'income' } },
    )
    expect(state.open?.draft.autoConfirm).toBe(false)
    expect(state.open?.draft.category).toBeNull()
  })

  it('opens the rule that staged a sample, else a new one', () => {
    const handled = run(loaded(rule('r1'), rule('r2')), {
      type: 'startFrom',
      ruleId: 'r2',
      rulesMax: 20,
    })
    expect(handled.open?.index).toBe(1)
    const fresh = run(loaded(rule('r1')), {
      type: 'startFrom',
      ruleId: 'gone',
      rulesMax: 20,
    })
    expect(fresh.open?.isNew).toBe(true)
  })

  it('tests the working set without a rule that has nothing to read yet', () => {
    const withNew = run(loaded(rule('r1'), rule('r2')), { type: 'add' })
    expect(workingSet(withNew)).toEqual({
      rules: [sendable(withNew.rules[0]), sendable(withNew.rules[1])],
      focusIndex: null,
    })
    const editing = run(loaded(rule('r1'), rule('r2')), {
      type: 'open',
      index: 1,
    })
    expect(workingSet(editing).focusIndex).toBe(1)
  })
})

describe('rule drafts', () => {
  it('names a rule after its sender when left blank', () => {
    const state = run(loaded(rule('r1', { name: '  ' })))
    expect(sendable(state.rules[0])?.name).toBe('alerts@bank.com')
  })

  it('never sends auto-confirm without an account', () => {
    const state = run(loaded(rule('r1', { autoConfirm: true })))
    expect(sendable(state.rules[0])?.autoConfirm).toBe(false)
  })

  it('describes a filter in words', () => {
    expect(
      describeFilter({
        senders: ['alerts@bank.com', 'cards@bank.com'],
        subjectAny: ['Purchase', 'POS'],
        bodyAny: [],
        excludeAny: ['OTP'],
      }),
    ).toBe(
      'From alerts@bank.com +1 · subject has “Purchase” or “POS” · not “OTP”',
    )
  })
})

describe('openRuleEdited', () => {
  it('is false for a rule opened and left alone, new or existing', () => {
    expect(openRuleEdited(run(loaded(rule('r1')), { type: 'add' }))).toBe(false)
    expect(
      openRuleEdited(run(loaded(rule('r1')), { type: 'open', index: 0 })),
    ).toBe(false)
  })

  it('is true once the open rule changes', () => {
    const renamed = run(
      loaded(rule('r1')),
      { type: 'open', index: 0 },
      { type: 'edit', patch: { name: 'Card' } },
    )
    expect(openRuleEdited(renamed)).toBe(true)
    const seeded = run(
      loaded(),
      { type: 'add' },
      { type: 'useSample', sample: SAMPLE, similar: [] },
    )
    expect(openRuleEdited(seeded)).toBe(true)
  })
})
