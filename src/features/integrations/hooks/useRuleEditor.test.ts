// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { aKey } from '#/features/integrations/__fixtures__/keys'
import type { DryRun, RuleSet } from '#/features/integrations/api/ruleTypes'
import type { Learned } from '#/features/text-templates/api/types'
import { ApiError } from '#/lib/apiError'
import { DRY_RUN_DEBOUNCE_MS } from './useDryRun'
import { useRuleEditor } from './useRuleEditor'

const api = {
  list: vi.fn(),
  replace: vi.fn(),
  dryRun: vi.fn(),
  learn: vi.fn(),
}

vi.mock('#/features/integrations/api/integrationRulesApi', () => ({
  integrationRulesApi: {
    list: (...a: unknown[]) => api.list(...a),
    replace: (...a: unknown[]) => api.replace(...a),
    dryRun: (...a: unknown[]) => api.dryRun(...a),
    learn: (...a: unknown[]) => api.learn(...a),
  },
}))

const importDetail = vi.fn()

vi.mock('#/features/inbound-imports/api/inboundImportsApi', () => ({
  inboundImportsApi: { getImport: (id: string) => importDetail(id) },
}))

const SAMPLE = '{"text": "SAR 152.75 spent at CARREFOUR on 23/09"}'

const EMPTY_RUN: DryRun = {
  matchedIndex: 0,
  trace: [
    { index: 0, ruleId: null, name: 'Rule 1', matched: true, detail: null },
  ],
  result: {
    fields: {},
    values: {
      date: '2026-09-23',
      type: 'SPEND',
      amount: null,
      currency: null,
      merchant: null,
      category: null,
      subcategory: null,
      note: null,
      externalId: null,
      wallet: null,
    },
    missing: [],
    resolved: { walletId: null, categoryId: null },
  },
  focus: null,
  would: 'STAGE',
}

const set = (rules: RuleSet['rules'] = [], version = 'v1'): RuleSet => ({
  version,
  rules,
})

const render = (options: { startWithNewRule?: boolean } = {}) =>
  renderHook(() => useRuleEditor({ keyId: 'k1', online: true, ...options }))

beforeEach(async () => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.dryRun.mockResolvedValue(EMPTY_RUN)
  await db.integrationKeys.clear()
})

afterEach(() => vi.useRealTimers())

describe('useRuleEditor', () => {
  it('opens a first rule for a freshly created key', async () => {
    api.list.mockResolvedValue(set())
    const { result } = render({ startWithNewRule: true })
    await waitFor(() => expect(result.current.open?.isNew).toBe(true))
    expect(result.current.target).toBe('amount')
  })

  it('tries the unsaved draft against the sample, once per burst of edits', async () => {
    api.list.mockResolvedValue(set())
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    vi.useFakeTimers()

    act(() => {
      result.current.setSample(SAMPLE)
      result.current.add()
    })
    for (const name of ['B', 'Ba', 'Ban', 'Bank']) {
      act(() => result.current.rename(name))
      act(() => vi.advanceTimersByTime(DRY_RUN_DEBOUNCE_MS / 2))
    }
    expect(api.dryRun).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(DRY_RUN_DEBOUNCE_MS)
      await Promise.resolve()
    })
    expect(api.dryRun).toHaveBeenCalledTimes(1)
    const [keyId, payload, rules, focus] = api.dryRun.mock.calls[0]
    expect(keyId).toBe('k1')
    expect(payload).toBe(SAMPLE)
    expect(rules).toEqual([
      { name: 'Bank', kind: 'JSON', match: null, fields: {} },
    ])
    expect(focus).toBe(0)
    expect(api.replace).not.toHaveBeenCalled()
  })

  it('saves the whole set with the set’s version and records the count', async () => {
    await db.integrationKeys.put(aKey({ id: 'k1', ruleCount: 0 }))
    api.list.mockResolvedValue(set())
    api.replace.mockResolvedValue(
      set(
        [{ id: 'r1', name: 'Bank', match: null, fields: {}, text: null }],
        'v2',
      ),
    )
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.add())
    act(() => result.current.rename('Bank'))
    act(() => result.current.closeRule(true))
    expect(result.current.dirty).toBe(true)

    let saved = false
    await act(async () => {
      saved = await result.current.save()
    })
    expect(saved).toBe(true)
    expect(api.replace).toHaveBeenCalledWith('k1', 'v1', [
      { id: null, name: 'Bank', match: null, fields: {}, text: null },
    ])
    expect(result.current.dirty).toBe(false)
    expect((await db.integrationKeys.get('k1'))?.ruleCount).toBe(1)
  })

  it('reports a refused save beside the rule it is about', async () => {
    api.list.mockResolvedValue(
      set([{ id: 'r1', name: 'A', match: null, fields: {}, text: null }]),
    )
    api.replace.mockRejectedValue(
      new ApiError({
        code: 'integrations.rule.path_invalid',
        message: '',
        status: 422,
        details: [
          {
            field: 'rules[0].fields.amount.path',
            code: 'integrations.rule.path_invalid',
          },
        ],
      }),
    )
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.openRule(0))
    act(() => result.current.setLocator('amount', { path: 'amount' }))
    act(() => result.current.closeRule(true))

    await act(async () => {
      await result.current.save()
    })
    expect(
      result.current.saveProblems.byRule.get(0)?.fields.amount,
    ).toBeTruthy()
    expect(result.current.conflict).toBe(false)

    act(() => result.current.move(0, 0))
    act(() => result.current.remove(0))
    expect(result.current.saveProblems.byRule.size).toBe(0)
  })

  it('flags a lost race as a conflict that only a reload resolves', async () => {
    api.list.mockResolvedValue(set())
    api.replace.mockRejectedValue(
      new ApiError({ code: 'common.conflict', message: '', status: 409 }),
    )
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.add())
    act(() => result.current.closeRule(true))
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.conflict).toBe(true)
  })

  it('retries the dry run without a pattern the server refuses', async () => {
    api.list.mockResolvedValue(set())
    api.dryRun
      .mockRejectedValueOnce(
        new ApiError({
          code: 'integrations.rule.regex_invalid',
          message: '',
          status: 422,
          details: [
            {
              field: 'rules[0].fields.merchant.regex',
              code: 'integrations.rule.regex_invalid',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(EMPTY_RUN)
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => {
      result.current.setSample(SAMPLE)
      result.current.add()
    })
    act(() => {
      result.current.setLocator('amount', { path: '$.text' })
      result.current.setLocator('merchant', { path: '$.text', regex: '((' })
    })

    await waitFor(() => expect(api.dryRun).toHaveBeenCalledTimes(2))
    const retried = api.dryRun.mock.calls[1][2] as Array<{ fields: object }>
    expect(Object.keys(retried[0].fields)).toEqual(['amount'])
    await waitFor(() =>
      expect(
        result.current.dryRun.problems.byRule.get(0)?.fields.merchant,
      ).toMatch(/pattern/),
    )
    expect(result.current.dryRun.result).toEqual(EMPTY_RUN)
  })

  it('does not run without a usable sample', async () => {
    api.list.mockResolvedValue(set())
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.setSample('[1, 2]'))
    await new Promise((r) => setTimeout(r, DRY_RUN_DEBOUNCE_MS + 50))
    expect(api.dryRun).not.toHaveBeenCalled()
    expect(result.current.reading).toMatchObject({ problem: 'not_object' })
  })

  it('opens the first rule on a staged import’s payload — “Fix the rule”', async () => {
    api.list.mockResolvedValue(
      set([
        { id: 'r1', name: 'Bank SMS', match: null, fields: {}, text: null },
      ]),
    )
    importDetail.mockResolvedValue({ bodyLines: ['{"text":"SAR 9.00"}'] })
    const { result } = renderHook(() =>
      useRuleEditor({ keyId: 'k1', online: true, sampleImportId: 'imp1' }),
    )
    await waitFor(() => expect(result.current.open?.index).toBe(0))
    await waitFor(() => expect(result.current.reading.ok).toBe(true))
    expect(importDetail).toHaveBeenCalledWith('imp1')
    expect(JSON.parse(result.current.sample)).toEqual({ text: 'SAR 9.00' })
  })

  it('opens the rule a delivery was handled by, on that delivery’s payload', async () => {
    api.list.mockResolvedValue(
      set([
        { id: 'r1', name: 'Purchase', match: null, fields: {}, text: null },
        { id: 'r2', name: 'Refund', match: null, fields: {}, text: null },
      ]),
    )
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.startFromPayload('{"kind":"refund"}', 'r2'))

    expect(result.current.open).toMatchObject({ index: 1, isNew: false })
    expect(JSON.parse(result.current.sample)).toEqual({ kind: 'refund' })
  })

  it('opens the handling rule by id even after the set was reordered meanwhile', async () => {
    api.list.mockResolvedValue(
      set([
        { id: 'r1', name: 'Purchase', match: null, fields: {}, text: null },
        { id: 'r2', name: 'Refund', match: null, fields: {}, text: null },
      ]),
    )
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const startedAtClick = result.current.startFromPayload

    act(() => result.current.move(1, 0))
    act(() => startedAtClick('{"kind":"refund"}', 'r2'))

    expect(result.current.open).toMatchObject({ index: 0, isNew: false })
    expect(result.current.open?.draft.id).toBe('r2')
  })

  it('starts a new rule from a delivery no rule handled', async () => {
    api.list.mockResolvedValue(
      set([
        { id: 'r1', name: 'Purchase', match: null, fields: {}, text: null },
      ]),
    )
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.startFromPayload('{"kind":"other"}', null))

    expect(result.current.open).toMatchObject({ index: 1, isNew: true })
    expect(result.current.reading.ok).toBe(true)
  })

  it('learns a text rule from its taps, and only then lets it be done', async () => {
    const learned: Learned = {
      template: {
        kind: 'anchored_lines',
        amount: { label: null, numberIndex: null, decimal: 'auto' },
        currency: { mode: 'from_email', label: null, code: 'SAR' },
        merchant: null,
      },
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
      labels: { amount: null, currency: null, merchant: null },
    }
    api.list.mockResolvedValue(set())
    api.learn.mockResolvedValue(learned)
    const { result } = render()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.setSample('Purchase of SAR 38.50 at CARREFOUR')
      result.current.add()
    })
    expect(result.current.open?.draft.text).not.toBeNull()
    expect(result.current.openProblem).toMatch(/Tap the amount/)

    act(() =>
      result.current.tap({
        type: 'pick',
        pick: { line: 0, start: 16, end: 21 },
      }),
    )
    act(() =>
      result.current.tap({
        type: 'pick',
        pick: { line: 0, start: 12, end: 15 },
      }),
    )
    await waitFor(() => expect(result.current.openProblem).toBeNull())
    expect(api.learn).toHaveBeenCalledTimes(1)
    const [keyId, request] = api.learn.mock.calls[0]
    expect(keyId).toBe('k1')
    expect(request.sample.bodyLines).toEqual([
      'Purchase of SAR 38.50 at CARREFOUR',
    ])
    expect(result.current.learned?.reading.amount).toBe(3850)
    expect(result.current.open?.draft.text?.template).toEqual(learned.template)
  })
})
