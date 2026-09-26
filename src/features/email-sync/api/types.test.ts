import { describe, expect, it } from 'vitest'
import type {
  ConnectionWire,
  EmailRuleSetWire,
  ExtractionWire,
  LearnResultWire,
  SampleVerdictWire,
  SyncResultWire,
} from './types'
import {
  fromWireFrequency,
  toConnection,
  toExtraction,
  toLearnRequestWire,
  toLearnResult,
  toRuleDraftWire,
  toRuleSet,
  toSampleVerdict,
  toSyncResult,
  toTemplate,
  toTemplateWire,
  toWireFrequency,
  toWireProvider,
} from './types'

const extractionWire = (
  over: Partial<ExtractionWire> = {},
): ExtractionWire => ({
  amount: 3850,
  currency: 'SAR',
  merchant: 'Jarir Bookstore',
  complete: true,
  fields: {
    amount: { status: 'OK', raw: '38.50', line: 3 },
    currency: { status: 'OK', raw: 'SAR', line: 3 },
    merchant: { status: 'HEURISTIC', raw: 'Jarir Bookstore', line: 5 },
  },
  ...over,
})

describe('email-sync enum maps', () => {
  it('round-trips scan frequency through the wire', () => {
    for (const f of ['15m', 'hourly', 'daily'] as const) {
      expect(fromWireFrequency(toWireFrequency(f))).toBe(f)
    }
  })

  it('maps providers to their UPPER_SNAKE wire names', () => {
    expect(toWireProvider('google')).toBe('GOOGLE')
    expect(toWireProvider('outlook')).toBe('OUTLOOK')
  })
})

describe('email-sync wire mappers', () => {
  it('maps a connection with its rule summaries', () => {
    const wire: ConnectionWire = {
      id: 'c1',
      provider: 'GOOGLE',
      email_address: 'khalid@example.com',
      auto_sync: true,
      scan_frequency: 'FIFTEEN_MIN',
      status: 'CONNECTED',
      last_synced_at: null,
      rules: [
        {
          id: 'r1',
          name: 'Card purchases',
          enabled: true,
          senders: ['alerts@bank.com'],
          wallet_id: 'w1',
          type: 'INCOME',
          auto_confirm: true,
        },
      ],
      created_at: '2026-06-13T00:00:00Z',
      updated_at: '2026-06-13T00:00:00Z',
      version: 'v1',
    }
    const c = toConnection(wire)
    expect(c.provider).toBe('google')
    expect(c.scanFrequency).toBe('15m')
    expect(c.status).toBe('connected')
    expect(c.rules[0]).toEqual({
      id: 'r1',
      name: 'Card purchases',
      enabled: true,
      senders: ['alerts@bank.com'],
      walletId: 'w1',
      type: 'income',
      autoConfirm: true,
    })
  })

  it('round-trips both kinds of template', () => {
    const fromEmail = toTemplate({
      kind: 'anchored_lines',
      amount: { anchor: 'amount', number_index: 1, decimal: 'COMMA' },
      currency: { mode: 'FROM_EMAIL', anchor: 'amount', code: 'SAR' },
      merchant: { anchor: 'merchant' },
    })
    expect(fromEmail.amount).toEqual({
      anchor: 'amount',
      numberIndex: 1,
      decimal: 'comma',
    })
    expect(fromEmail.currency).toEqual({
      mode: 'from_email',
      anchor: 'amount',
      code: 'SAR',
    })
    expect(toTemplateWire(fromEmail).amount.decimal).toBe('COMMA')

    const fixed = toTemplate({
      kind: 'anchored_lines',
      amount: { anchor: 'total', number_index: null, decimal: 'AUTO' },
      currency: { mode: 'FIXED', code: 'KWD' },
      merchant: null,
    })
    expect(fixed.currency).toEqual({ mode: 'fixed', code: 'KWD' })
    expect(toTemplateWire(fixed).currency).toEqual({
      mode: 'FIXED',
      code: 'KWD',
    })
  })

  it('orders a rule set by position and sends a new rule without an id', () => {
    const wire: EmailRuleSetWire = {
      version: 'set-1',
      rules: [2, 0, 1].map((position) => ({
        id: `r${position}`,
        position,
        name: `Rule ${position}`,
        enabled: true,
        filter: {
          senders: ['alerts@bank.com'],
          subject_any: ['Purchase'],
          body_any: [],
          exclude_any: ['OTP'],
        },
        template: {
          kind: 'anchored_lines',
          amount: { anchor: 'amount', number_index: null, decimal: 'AUTO' },
          currency: { mode: 'FROM_EMAIL', anchor: 'amount', code: null },
          merchant: null,
        },
        wallet_id: null,
        type: 'SPEND',
        category_id: null,
        auto_confirm: false,
        created_at: '',
        updated_at: '',
        version: 'v',
      })),
    }
    const set = toRuleSet(wire)
    expect(set.rules.map((r) => r.id)).toEqual(['r0', 'r1', 'r2'])
    expect(set.rules[0].filter.excludeAny).toEqual(['OTP'])

    const draft = toRuleDraftWire({ ...set.rules[0], id: null })
    expect('id' in draft).toBe(false)
    expect(draft.filter.subject_any).toEqual(['Purchase'])
    expect(draft.type).toBe('SPEND')
  })

  it('lower-cases reading statuses', () => {
    const e = toExtraction(
      extractionWire({
        amount: null,
        complete: false,
        fields: {
          amount: { status: 'ANCHOR_NOT_FOUND', raw: null, line: null },
          currency: { status: 'NO_CURRENCY', raw: null, line: null },
          merchant: { status: 'NOT_SET', raw: null, line: null },
        },
      }),
    )
    expect(e.fields.amount.status).toBe('anchor_not_found')
    expect(e.fields.merchant.status).toBe('not_set')
  })

  it('sends a learn request in wire casing', () => {
    const wire = toLearnRequestWire({
      sample: {
        id: 'm1',
        senderEmail: 'alerts@bank.com',
        subject: 'Purchase',
        bodyLines: ['Amount: SAR 38.50'],
      },
      picks: {
        amount: { line: 0, start: 12, end: 17 },
        currency: { line: 0 },
        merchant: null,
      },
      options: { decimal: 'dot', currency: { mode: 'from_email', code: null } },
      similar: [],
    })
    expect(wire.sample.sender_email).toBe('alerts@bank.com')
    expect(wire.picks.amount).toEqual({ line: 0, start: 12, end: 17 })
    expect(wire.options).toEqual({
      decimal: 'DOT',
      currency: { mode: 'FROM_EMAIL', code: null },
    })
  })

  it('maps a learn result with its suggested filter', () => {
    const wire: LearnResultWire = {
      template: {
        kind: 'anchored_lines',
        amount: { anchor: 'amount', number_index: 0, decimal: 'AUTO' },
        currency: { mode: 'FROM_EMAIL', anchor: 'amount', code: 'SAR' },
        merchant: null,
      },
      reading: extractionWire(),
      similar: [extractionWire(), extractionWire({ complete: false })],
      suggested_filter: {
        senders: ['alerts@bank.com'],
        subject_any: ['Purchase'],
        body_any: [],
        exclude_any: [],
      },
    }
    const result = toLearnResult(wire)
    expect(result.similar).toHaveLength(2)
    expect(result.suggestedFilter.subjectAny).toEqual(['Purchase'])
  })

  it('maps a test verdict with its focus reading', () => {
    const wire: SampleVerdictWire = {
      sample_id: 'm1',
      matched_index: 0,
      matched_rule_id: 'r1',
      extraction: extractionWire(),
      focus: { matched: true, extraction: extractionWire() },
      would: 'POST',
    }
    const v = toSampleVerdict(wire)
    expect(v.would).toBe('post')
    expect(v.focus?.matched).toBe(true)
  })

  it('reads per-inbox completeness from a sync result, defaulting what older servers omit', () => {
    const wire: SyncResultWire = {
      synced_connections: 1,
      scanned_messages: 100,
      new_imports: 4,
      auto_confirmed: 1,
      failures: [],
    }
    expect(toSyncResult(wire)).toMatchObject({ ignored: 0, connections: [] })

    const full = toSyncResult({
      ...wire,
      ignored: 3,
      connections: [
        {
          connection_id: 'c1',
          scanned_messages: 100,
          new_imports: 4,
          auto_confirmed: 1,
          ignored: 3,
          complete: false,
        },
      ],
    })
    expect(full.connections[0]).toMatchObject({
      connectionId: 'c1',
      complete: false,
    })
  })
})
