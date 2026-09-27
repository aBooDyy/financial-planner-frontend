import { describe, expect, it } from 'vitest'
import type {
  EmailRule,
  EmailSample,
  ExtractionTemplate,
  LearnResult,
} from '#/features/email-sync/api/types'
import { learnRequestOf, pickForLine, signatureOf } from './mapping'
import { describeFilter, describeTemplate, sendable } from './ruleDraft'
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
  amount: {
    label: { text: 'amount', offset: 0 },
    numberIndex: null,
    decimal: 'auto',
  },
  currency: {
    mode: 'from_email',
    label: { text: 'amount', offset: 0 },
    code: 'SAR',
  },
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
  categoryId: null,
  defaultMerchant: null,
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
  labels: { amount: null, currency: null, merchant: null },
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

/** The Bank Albilad layout: every label on its own line, its value on the next. */
const TABLE: EmailSample = {
  id: 'm2',
  senderEmail: 'alerts@albilad.com',
  senderName: 'Bank Albilad',
  subject: 'Purchase',
  bodyLines: [
    'Bank Albilad',
    'DATE AND TIME',
    '2026-08-08 23:26',
    'التاريخ والوقت',
    'TRANSACTION REF',
    'FT26220827282127',
    'رقم العملية',
    'Amount',
    '10   ( SAR )',
    'مبلغ وقدره',
    'Merchant name',
    'MUGHASIL',
  ],
}

const tagged = (): RuleEditorState =>
  run(
    loaded(),
    { type: 'add' },
    { type: 'useSample', sample: TABLE, similar: [] },
    { type: 'pick', pick: pickForLine(TABLE.bodyLines[8], 8, 'amount') },
    { type: 'pick', pick: { line: 8 } },
  )

describe('ruleEditorReducer — choosing a label', () => {
  it('names the label with the next tap and sends it with the learn', () => {
    let state = ruleEditorReducer(tagged(), {
      type: 'labelMode',
      field: 'amount',
    })
    expect(state.open?.labelFor).toBe('amount')
    const before = signatureOf(learnRequestOf(state.open!.mapping))

    state = ruleEditorReducer(state, { type: 'pickLabel', line: 7 })
    expect(state.open?.labelFor).toBeNull()
    expect(state.open?.target).toBeNull()
    const request = learnRequestOf(state.open!.mapping)
    expect(request?.picks.amount).toEqual({
      line: 8,
      start: 0,
      end: 2,
      labelLine: 7,
    })
    expect(request?.picks.currency).toEqual({ line: 8 })
    expect(signatureOf(request)).not.toBe(before)
  })

  it('refuses a line too far from the value, or one without words, and stays waiting', () => {
    const choosing = ruleEditorReducer(tagged(), {
      type: 'labelMode',
      field: 'amount',
    })
    for (const line of [1, 4, 8]) {
      const state = ruleEditorReducer(choosing, { type: 'pickLabel', line })
      expect(state.open?.labelFor).toBe('amount')
      expect(state.open?.mapping.picks.amount?.labelLine).toBeUndefined()
    }
  })

  it('does not enter label mode for a field that is not tagged', () => {
    const state = ruleEditorReducer(tagged(), {
      type: 'labelMode',
      field: 'merchant',
    })
    expect(state.open?.labelFor).toBeNull()
  })

  it('drops the label when the value is tapped again, but keeps it for another number on the line', () => {
    const labelled = run(
      loaded(),
      { type: 'add' },
      { type: 'useSample', sample: TABLE, similar: [] },
      { type: 'pick', pick: { line: 8 } },
      { type: 'pick', pick: { line: 8 } },
      { type: 'labelMode', field: 'amount' },
      { type: 'pickLabel', line: 7 },
    )
    const refined = ruleEditorReducer(labelled, {
      type: 'setPick',
      field: 'amount',
      pick: { line: 8, start: 0, end: 2 },
    })
    expect(refined.open?.mapping.picks.amount?.labelLine).toBe(7)

    const retap: RuleEditorAction[] = [
      { type: 'target', target: 'amount' },
      { type: 'pick', pick: { line: 8 } },
    ]
    const retapped = retap.reduce(ruleEditorReducer, labelled)
    expect(retapped.open?.mapping.picks.amount).toEqual({ line: 8 })
  })

  it('lets the server find the label again on Auto', () => {
    const state = run(
      loaded(),
      { type: 'add' },
      { type: 'useSample', sample: TABLE, similar: [] },
      { type: 'pick', pick: { line: 8 } },
      { type: 'pick', pick: { line: 8 } },
      { type: 'labelMode', field: 'currency' },
      { type: 'pickLabel', line: 7 },
      { type: 'clearLabel', field: 'currency' },
    )
    expect(state.open?.mapping.picks.currency).toEqual({ line: 8 })
  })

  it('leaves label mode on a new target, a new sample or a fixed currency', () => {
    const choosing = ruleEditorReducer(tagged(), {
      type: 'labelMode',
      field: 'currency',
    })
    expect(
      ruleEditorReducer(choosing, { type: 'target', target: 'merchant' }).open
        ?.labelFor,
    ).toBeNull()
    expect(
      ruleEditorReducer(choosing, {
        type: 'useSample',
        sample: SAMPLE,
        similar: [],
      }).open?.labelFor,
    ).toBeNull()
    expect(
      ruleEditorReducer(choosing, {
        type: 'currency',
        mode: 'fixed',
        code: 'SAR',
      }).open?.labelFor,
    ).toBeNull()
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
        rule('r1', {
          walletId: 'w1',
          autoConfirm: true,
          categoryId: 'cat-food',
        }),
      ),
      { type: 'open', index: 0 },
      { type: 'edit', patch: { walletId: null } },
      { type: 'edit', patch: { type: 'income' } },
    )
    expect(state.open?.draft.autoConfirm).toBe(false)
    expect(state.open?.draft.categoryId).toBeNull()
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

  it('describes a template by its labels and where the values sit', () => {
    expect(describeTemplate(TEMPLATE)).toBe(
      'Reads amount after “amount”, currency',
    )
    expect(
      describeTemplate({
        kind: 'anchored_lines',
        amount: {
          label: { text: 'amount', offset: 1 },
          numberIndex: null,
          decimal: 'auto',
        },
        currency: { mode: 'from_email', label: null, code: 'SAR' },
        merchant: { label: { text: 'merchant name', offset: 2 } },
      }),
    ).toBe(
      'Reads amount below “amount”, currency by keywords, merchant 2 lines below “merchant name”',
    )
    expect(
      describeTemplate({
        ...TEMPLATE,
        amount: { ...TEMPLATE.amount, label: null },
        currency: { mode: 'fixed', code: 'KWD' },
      }),
    ).toBe('Reads amount by keywords, always KWD')
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
