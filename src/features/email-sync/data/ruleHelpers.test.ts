import { describe, expect, it } from 'vitest'
import type { SampleVerdict } from '#/features/email-sync/api/types'
import { ApiError } from '#/lib/apiError'
import { SETTINGS_PATH, connectedReturnUrl } from './connect'
import { ruleProblems } from './ruleErrors'
import { focusMatches, handledCounts, unhandled } from './verdicts'

const verdict = (
  matchedIndex: number | null,
  focusMatched: boolean | null = null,
): SampleVerdict => ({
  sampleId: null,
  matchedIndex,
  matchedRuleId: null,
  extraction: null,
  focus:
    focusMatched === null
      ? null
      : {
          matched: focusMatched,
          extraction: {
            amount: null,
            currency: null,
            merchant: null,
            complete: false,
            fields: {
              amount: { status: 'not_set', raw: null, line: null },
              currency: { status: 'not_set', raw: null, line: null },
              merchant: { status: 'not_set', raw: null, line: null },
            },
          },
        },
  would: matchedIndex === null ? 'ignore' : 'stage',
})

describe('verdicts', () => {
  it('counts what each rule handles, first match winning', () => {
    const verdicts = [verdict(0), verdict(1), verdict(0), verdict(null)]
    expect(handledCounts(verdicts, 3)).toEqual([2, 1, 0])
    expect(unhandled(verdicts)).toBe(1)
  })

  it('says how much of the open rule’s catch an earlier rule takes', () => {
    const verdicts = [verdict(0, true), verdict(1, true), verdict(null, false)]
    expect(focusMatches(verdicts, 1)).toMatchObject({
      total: 3,
      takenEarlier: 1,
    })
    expect(focusMatches(verdicts, 1).matched).toHaveLength(2)
  })
})

describe('ruleProblems', () => {
  it('puts each refusal beside its control on its rule', () => {
    const error = new ApiError({
      code: 'common.validation',
      message: 'x',
      status: 422,
      details: [
        {
          field: 'rules[1].filter.subject_any',
          code: 'email_sync.rule.term_invalid',
        },
        {
          field: 'rules[1].filter.senders',
          code: 'email_sync.rule.senders_invalid',
        },
        {
          field: 'rules[0].template.currency.code',
          code: 'email_sync.rule.currency_invalid',
        },
        { field: 'rules[0].wallet_id', code: 'email_sync.rule.wallet_invalid' },
      ],
    })
    const problems = ruleProblems(error)
    expect(problems.general).toBeNull()
    expect(Object.keys(problems.byRule.get(1)!)).toEqual(['terms', 'senders'])
    expect(problems.byRule.get(0)?.walletId).toBe(
      'Choose one of your accounts.',
    )
    expect(problems.byRule.get(0)?.template).toBeTruthy()
  })

  it('is one general line for anything not about a rule', () => {
    const problems = ruleProblems(
      new ApiError({
        code: 'email_sync.rule.limit_reached',
        message: 'x',
        status: 422,
      }),
    )
    expect(problems.byRule.size).toBe(0)
    expect(problems.general).toContain('20 rules')
  })
})

describe('connectedReturnUrl', () => {
  it('opens a new inbox on its first rule back in Settings', () => {
    expect(connectedReturnUrl(SETTINGS_PATH, 'c1')).toBe(
      '/settings/email-sync?inbox=c1&fresh=1',
    )
  })

  it('leaves any other return path alone', () => {
    expect(connectedReturnUrl('/setup', 'c1')).toBe('/setup')
    expect(connectedReturnUrl(SETTINGS_PATH, null)).toBe(SETTINGS_PATH)
  })
})
