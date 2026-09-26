// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  EmailRule,
  EmailRuleSet,
  EmailSample,
  ExtractionTemplate,
  LearnResult,
} from '#/features/email-sync/api/types'
import { ApiError } from '#/lib/apiError'
import { useEmailRuleEditor } from './useEmailRuleEditor'

const getRules = vi.fn()
const learn = vi.fn()
const test = vi.fn()
const saveRules = vi.fn()
const getImport = vi.fn()

vi.mock('#/features/email-sync/api/emailSyncApi', () => ({
  emailSyncApi: {
    getRules: (...a: unknown[]) => getRules(...a),
    learn: (...a: unknown[]) => learn(...a),
    test: (...a: unknown[]) => test(...a),
  },
}))
vi.mock('#/features/email-sync/data/mutations', () => ({
  saveRules: (...a: unknown[]) => saveRules(...a),
}))
vi.mock('#/features/inbound-imports/api/inboundImportsApi', () => ({
  inboundImportsApi: { getImport: (...a: unknown[]) => getImport(...a) },
}))

const TEMPLATE: ExtractionTemplate = {
  kind: 'anchored_lines',
  amount: { anchor: 'amount', numberIndex: null, decimal: 'auto' },
  currency: { mode: 'from_email', anchor: 'amount', code: 'SAR' },
  merchant: null,
}

const rule = (id: string): EmailRule => ({
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
})

const SAMPLE: EmailSample = {
  id: 'm1',
  senderEmail: 'alerts@bank.com',
  senderName: 'Bank',
  subject: 'Purchase',
  bodyLines: ['Amount: SAR 38.50'],
}

const LEARNED: LearnResult = {
  template: { ...TEMPLATE, amount: { ...TEMPLATE.amount, decimal: 'dot' } },
  reading: {
    amount: 3850,
    currency: 'SAR',
    merchant: null,
    complete: true,
    fields: {
      amount: { status: 'ok', raw: '38.50', line: 0 },
      currency: { status: 'ok', raw: 'SAR', line: 0 },
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
}

const set = (...rules: EmailRule[]): EmailRuleSet => ({
  version: 'set-1',
  rules,
})

beforeEach(() => {
  getRules.mockReset().mockResolvedValue(set(rule('r1')))
  learn.mockReset().mockResolvedValue(LEARNED)
  test.mockReset().mockResolvedValue([])
  saveRules.mockReset()
  getImport.mockReset()
})

const renderEditor = (
  options: Partial<Parameters<typeof useEmailRuleEditor>[0]> = {},
) =>
  renderHook(() =>
    useEmailRuleEditor({
      connectionId: 'c1',
      online: true,
      samples: [SAMPLE],
      ...options,
    }),
  )

describe('useEmailRuleEditor', () => {
  it('opens straight onto a new rule for a fresh inbox', async () => {
    const { result } = renderEditor({ startWithNewRule: true })
    await waitFor(() => expect(result.current.open?.isNew).toBe(true))
  })

  it('learns a template once the picks are complete, and only then may the rule be done', async () => {
    const { result } = renderEditor({ startWithNewRule: true })
    await waitFor(() => expect(result.current.open).not.toBeNull())

    act(() => result.current.chooseSample(SAMPLE, []))
    act(() => result.current.pick({ line: 0, start: 12, end: 17 }))
    expect(result.current.problems.template).toBeTruthy()
    act(() => result.current.pick({ line: 0 }))

    await waitFor(() => expect(result.current.current).toBe(true))
    expect(learn).toHaveBeenCalledTimes(1)
    expect(learn.mock.calls[0][0]).toBe('c1')
    expect(learn.mock.calls[0][1].picks.amount).toEqual({
      line: 0,
      start: 12,
      end: 17,
    })
    expect(result.current.learned?.reading.amount).toBe(3850)
    expect(result.current.open?.draft.template?.amount.decimal).toBe('dot')
    expect(result.current.problems).toEqual({})
  })

  it('saves the whole set with its version and keeps the new version', async () => {
    saveRules.mockResolvedValue({ version: 'set-2', rules: [rule('r1')] })
    const { result } = renderEditor()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.toggleEnabled(0))
    expect(result.current.dirty).toBe(true)
    let saved = false
    await act(async () => {
      saved = await result.current.save()
    })

    expect(saved).toBe(true)
    expect(saveRules).toHaveBeenCalledWith('c1', 'set-1', [
      expect.objectContaining({ id: 'r1', enabled: false }),
    ])
    expect(result.current.dirty).toBe(false)
  })

  it('puts a refused field beside its rule and reports a lost race as a conflict', async () => {
    saveRules.mockRejectedValueOnce(
      new ApiError({
        code: 'common.validation',
        message: 'x',
        status: 422,
        details: [
          {
            field: 'rules[0].wallet_id',
            code: 'email_sync.rule.wallet_invalid',
          },
        ],
      }),
    )
    const { result } = renderEditor()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.toggleEnabled(0))
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.saveProblems.byRule.get(0)?.walletId).toBeTruthy()

    saveRules.mockRejectedValueOnce(
      new ApiError({ code: 'common.conflict', message: 'x', status: 409 }),
    )
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.conflict).toBe(true)
  })

  it('fixes a rule on the email it could not read', async () => {
    getImport.mockResolvedValue({
      import: {
        sourceRef: 'alerts@bank.com',
        sourceLabel: 'Bank',
        subject: 'Purchase',
      },
      bodyLines: ['Total 38.50 SAR'],
      bodyTruncated: false,
      merchant: null,
    })
    const { result } = renderEditor({
      fix: { ruleId: 'r1', importId: 'i1' },
    })

    await waitFor(() =>
      expect(result.current.open?.mapping.sample?.bodyLines).toEqual([
        'Total 38.50 SAR',
      ]),
    )
    expect(result.current.open?.isNew).toBe(false)
    expect(getImport).toHaveBeenCalledWith('i1')
  })
})
