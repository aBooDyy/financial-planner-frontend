// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OFFLINE_HINT, OfflineNotice } from './OfflineNotice'

afterEach(cleanup)

describe('OfflineNotice', () => {
  it('says the action returns with the connection by default', () => {
    render(<OfflineNotice />)
    expect(screen.getByRole('status')).toHaveProperty(
      'textContent',
      OFFLINE_HINT,
    )
  })

  it('carries a surface’s own reason', () => {
    render(<OfflineNotice>Signing in needs a connection.</OfflineNotice>)
    expect(screen.getByRole('status').textContent).toBe(
      'Signing in needs a connection.',
    )
  })
})
