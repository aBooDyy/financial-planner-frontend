import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalBalanceSettings } from '#/db/types'
import type {
  BalanceSettings,
  UpdateSettingsWire,
} from '#/features/wallets/api/types'
import { ApiError } from '#/lib/apiError'

const api = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  getSettings: vi.fn(),
}))
vi.mock('#/features/wallets/api/walletsApi', () => ({
  walletsApi: api,
}))

const { flushOutbox } = await import('#/db/sync')
const { forgetMainIncomeStream, setBaseCurrency, updatePlanningSettings } =
  await import('./mutations')
const { planningSettingsOf } = await import('./mappers')

/** A row as stored before the planning settings existed. */
const olderRow = (): LocalBalanceSettings => ({
  id: SETTINGS_KEY,
  baseCurrency: 'SAR',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 'v1',
  dirty: 0,
})

const serverEcho = (
  body: UpdateSettingsWire,
  version: string,
): BalanceSettings => ({
  baseCurrency: 'SAR',
  safeHorizon: body.safe_horizon === 'DAYS' ? 'days' : 'until_payday',
  safeHorizonDays: body.safe_horizon_days,
  paydayMode: body.payday_mode === 'AUTO' ? 'auto' : 'review',
  mainIncomeStreamId: body.main_income_stream_id,
  incomeVaries: body.income_varies,
  incomeFloor: body.income_floor,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  version,
})

const queued = async () =>
  (await db.outbox.toArray()).map((e) => e.payload as UpdateSettingsWire)

beforeEach(async () => {
  vi.clearAllMocks()
  await db.balanceSettings.clear()
  await db.outbox.clear()
  await db.balanceSettings.put(olderRow())
})

describe('planning settings', () => {
  it('reads an older row with every default filled in', async () => {
    expect(planningSettingsOf(await db.balanceSettings.get(SETTINGS_KEY))).toEqual({
      safeHorizon: 'until_payday',
      safeHorizonDays: null,
      paydayMode: 'review',
      mainIncomeStreamId: null,
      incomeVaries: false,
      incomeFloor: null,
    })
  })

  it('queues a full representation, dropping what a setting does not use', async () => {
    await updatePlanningSettings({
      safeHorizon: 'days',
      safeHorizonDays: 14,
      incomeFloor: 500000,
    })

    expect(await db.balanceSettings.get(SETTINGS_KEY)).toMatchObject({
      safeHorizon: 'days',
      safeHorizonDays: 14,
      // A floor only means something while income varies.
      incomeFloor: null,
      dirty: 1,
    })
    expect(await queued()).toEqual([
      {
        version: 'v1',
        base_currency: 'SAR',
        safe_horizon: 'DAYS',
        safe_horizon_days: 14,
        payday_mode: 'REVIEW',
        main_income_stream_id: null,
        income_varies: false,
        income_floor: null,
      },
    ])

    await updatePlanningSettings({ safeHorizon: 'end_of_month' })
    const [payload] = await queued()
    expect(payload).toMatchObject({
      safe_horizon: 'END_OF_MONTH',
      safe_horizon_days: null,
    })
  })

  it('keeps the planning settings when the base currency changes', async () => {
    await updatePlanningSettings({ paydayMode: 'auto', incomeVaries: true })
    await setBaseCurrency('USD')

    const payloads = await queued()
    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      base_currency: 'USD',
      payday_mode: 'AUTO',
      income_varies: true,
    })
  })

  it('forgets a deleted main paycheck, rebuilding a queued PATCH', async () => {
    await updatePlanningSettings({ mainIncomeStreamId: 'inc-1' })

    await forgetMainIncomeStream('inc-2')
    expect((await queued())[0].main_income_stream_id).toBe('inc-1')

    await forgetMainIncomeStream('inc-1')
    expect(
      (await db.balanceSettings.get(SETTINGS_KEY))?.mainIncomeStreamId,
    ).toBeNull()
    expect((await queued())[0].main_income_stream_id).toBeNull()
  })

  it('rebases a stale PATCH by re-sending the whole local row', async () => {
    await updatePlanningSettings({ paydayMode: 'auto' })
    api.updateSettings
      .mockRejectedValueOnce(
        new ApiError({ status: 409, code: 'common.conflict', message: '' }),
      )
      .mockImplementationOnce((body: UpdateSettingsWire) =>
        Promise.resolve(serverEcho(body, 'v3')),
      )
    api.getSettings.mockResolvedValue({
      ...serverEcho((await queued())[0], 'v2'),
      paydayMode: 'review',
    })

    await flushOutbox()

    expect(api.updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ version: 'v2', payday_mode: 'AUTO' }),
    )
    expect(await db.outbox.count()).toBe(0)
    expect(await db.balanceSettings.get(SETTINGS_KEY)).toMatchObject({
      paydayMode: 'auto',
      version: 'v3',
      dirty: 0,
    })
  })
})
