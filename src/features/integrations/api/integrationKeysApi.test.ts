import { afterEach, expect, it, vi } from 'vitest'
import { http } from '#/lib/http'
import { integrationKeysApi } from './integrationKeysApi'

afterEach(() => vi.restoreAllMocks())

it('encodes a key id so it cannot climb out of its resource', async () => {
  const del = vi.spyOn(http, 'del').mockResolvedValue(undefined)
  await integrationKeysApi.remove('../auth')
  expect(del).toHaveBeenCalledWith('/integration-keys/..%2Fauth')
})
