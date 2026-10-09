// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '#/features/auth/api/types'
import { markResumeSetup } from '#/features/passkeys/data/setupFlags'
import { useSessionStore } from '#/stores/session'
import { GoogleCallback } from './GoogleCallback'

/**
 * The Google callback is also where re-verifying before adding a passkey comes back to, so it
 * decides between landing on the app (and offering a passkey) and carrying that setup on.
 */

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  googleCallback: vi.fn(),
  clearLocalDb: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => h.navigate,
}))

vi.mock('#/features/auth/api/authApi', () => ({
  authApi: {
    googleCallback: (code: string, state: string) =>
      h.googleCallback(code, state),
  },
}))

vi.mock('#/db/db', () => ({ clearLocalDb: () => h.clearLocalDb() }))

const user = (id: string): User => ({
  id,
  email: `${id}@b.c`,
  name: id,
  onboardedAt: '2026-01-01T00:00:00Z',
  hasPassword: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 'v1',
})

const JUST_SIGNED_IN = 'fp:passkey-just-signed-in'
const RESUME = 'fp:passkey-resume-setup'

const arrive = (search: string) =>
  window.history.replaceState(null, '', `/auth/google/callback${search}`)

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  localStorage.clear()
  h.clearLocalDb.mockResolvedValue(undefined)
  useSessionStore.setState({ status: 'anonymous', user: null, verified: false })
  arrive('?code=c&state=s')
})

afterEach(cleanup)

describe('Google callback', () => {
  it('lands a sign-in on the app and offers a passkey afterwards', async () => {
    h.googleCallback.mockResolvedValue(user('u1'))
    render(<GoogleCallback />)

    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ to: '/' }))
    expect(useSessionStore.getState().user?.id).toBe('u1')
    expect(sessionStorage.getItem(JUST_SIGNED_IN)).toBe('u1')
  })

  it('returns a re-verify to Sign-in & security to finish the passkey', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: user('u1'),
      verified: true,
    })
    markResumeSetup()
    h.googleCallback.mockResolvedValue(user('u1'))
    render(<GoogleCallback />)

    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith({ to: '/settings/security' }),
    )
    expect(sessionStorage.getItem(RESUME)).not.toBeNull()
    expect(sessionStorage.getItem(JUST_SIGNED_IN)).toBeNull()
    expect(h.clearLocalDb).not.toHaveBeenCalled()
  })

  it('drops the setup and the local data when Google came back as someone else', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: user('u1'),
      verified: true,
    })
    markResumeSetup()
    h.googleCallback.mockResolvedValue(user('u2'))
    render(<GoogleCallback />)

    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ to: '/' }))
    expect(h.clearLocalDb).toHaveBeenCalled()
    expect(useSessionStore.getState().user?.id).toBe('u2')
    expect(sessionStorage.getItem(RESUME)).toBeNull()
  })

  it('forgets the setup when the round trip was cancelled', async () => {
    markResumeSetup()
    arrive('?error=access_denied')
    render(<GoogleCallback />)

    await waitFor(() => expect(sessionStorage.getItem(RESUME)).toBeNull())
    expect(h.googleCallback).not.toHaveBeenCalled()
  })
})
