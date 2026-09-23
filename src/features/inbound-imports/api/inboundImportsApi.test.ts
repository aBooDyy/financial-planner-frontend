import { afterEach, expect, it, vi } from 'vitest'
import { http } from '#/lib/http'
import { inboundImportsApi } from './inboundImportsApi'

afterEach(() => vi.restoreAllMocks())

it('encodes an import id so it cannot climb out of its resource', async () => {
  const get = vi.spyOn(http, 'get').mockRejectedValue(new Error('stop'))
  await inboundImportsApi.getImport('../auth/me').catch(() => undefined)
  expect(get).toHaveBeenCalledWith('/inbound-imports/..%2Fauth%2Fme')
})
