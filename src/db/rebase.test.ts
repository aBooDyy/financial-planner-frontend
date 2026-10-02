import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type {
  BalanceSettings,
  UpdateSettingsWire,
} from '#/features/wallets/api/types'
import { ApiError } from '#/lib/apiError'

const api = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  getSettings: vi.fn(),
}))
vi.mock('#/features/wallets/api/walletsApi', () => ({ walletsApi: api }))

const { flushOutbox, pullSettings } = await import('./sync')
const { setBaseCurrency } = await import('#/features/wallets/data/mutations')

const server = (over: Partial<BalanceSettings> = {}): BalanceSettings => ({
  baseCurrency: 'SAR',
  safeHorizon: 'until_payday',
  safeHorizonDays: null,
  paydayMode: 'review',
  mainIncomeStreamId: null,
  incomeVaries: false,
  incomeFloor: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 'v1',
  ...over,
})

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all([db.balanceSettings.clear(), db.outbox.clear()])
})

describe('rebasing the settings after a conflict', () => {
  it('re-applies only what this device changed, keeping another device’s planning settings', async () => {
    api.getSettings.mockResolvedValueOnce(server())
    await pullSettings()
    await setBaseCurrency('USD')
    api.getSettings.mockResolvedValue(
      server({ paydayMode: 'auto', incomeVaries: true, version: 'v2' }),
    )
    api.updateSettings
      .mockRejectedValueOnce(
        new ApiError({ status: 409, code: 'common.conflict', message: '' }),
      )
      .mockImplementationOnce((body: UpdateSettingsWire) =>
        Promise.resolve(
          server({
            baseCurrency: body.base_currency,
            paydayMode: body.payday_mode === 'AUTO' ? 'auto' : 'review',
            incomeVaries: body.income_varies,
            version: 'v3',
          }),
        ),
      )

    await flushOutbox()

    expect(api.updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        version: 'v2',
        base_currency: 'USD',
        payday_mode: 'AUTO',
        income_varies: true,
      }),
    )
    expect(await db.balanceSettings.get(SETTINGS_KEY)).toMatchObject({
      baseCurrency: 'USD',
      paydayMode: 'auto',
      dirty: 0,
    })
  })
})
