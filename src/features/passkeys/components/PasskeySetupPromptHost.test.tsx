// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { User } from '#/features/auth/api/types'
import { stubBrowser } from '#/features/planning/testing/dom'
import { markJustSignedIn } from '#/features/passkeys/data/setupFlags'
import { useSessionStore } from '#/stores/session'
import { PasskeySetupPromptHost } from './PasskeySetupPromptHost'

const h = vi.hoisted(() => ({
  path: { value: '/wallets' },
  platform: vi.fn(),
  list: vi.fn(),
  options: vi.fn(),
  verify: vi.fn(),
  startRegistration: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (s: { location: { pathname: string } }) => string
  }) => select({ location: { pathname: h.path.value } }),
}))

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => true,
  platformAuthenticatorIsAvailable: () => h.platform(),
  startRegistration: (args: unknown) => h.startRegistration(args),
}))

vi.mock('#/features/passkeys/api/passkeysApi', () => ({
  passkeysApi: {
    list: () => h.list(),
    registrationOptions: (password?: string) => h.options(password),
    registrationVerify: (payload: unknown) => h.verify(payload),
  },
}))

const USER: User = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  onboardedAt: '2026-01-01T00:00:00Z',
  hasPassword: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 'v1',
}
const DISMISSED = 'fp:passkey-prompt-dismissed:u1'
const TITLE = 'Sign in faster next time'

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })

const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 20)))

beforeAll(stubBrowser)

beforeEach(() => {
  vi.clearAllMocks()
  h.path.value = '/wallets'
  h.platform.mockResolvedValue(true)
  h.list.mockResolvedValue([])
  sessionStorage.clear()
  localStorage.clear()
  useSessionStore.setState({
    status: 'authenticated',
    user: USER,
    verified: true,
  })
})

afterEach(() => {
  cleanup()
  setOnline(true)
})

describe('the passkey setup offer', () => {
  it('follows a password or Google sign-in for a user with no passkeys', async () => {
    markJustSignedIn('u1')
    render(<PasskeySetupPromptHost />)

    expect(await screen.findByRole('dialog', { name: TITLE })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Set up a passkey' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy()
  })

  it('is offered once per sign-in', async () => {
    markJustSignedIn('u1')
    render(<PasskeySetupPromptHost />)
    await screen.findByRole('dialog', { name: TITLE })

    expect(sessionStorage.getItem('fp:passkey-just-signed-in')).toBeNull()
  })

  it('stays away on a restored session', async () => {
    render(<PasskeySetupPromptHost />)
    await settle()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.list).not.toHaveBeenCalled()
  })

  it('ignores a sign-in made by someone else', async () => {
    markJustSignedIn('u2')
    render(<PasskeySetupPromptHost />)
    await settle()

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('waits until first-run setup is done', async () => {
    markJustSignedIn('u1')
    h.path.value = '/setup'
    const { rerender } = render(<PasskeySetupPromptHost />)
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.list).not.toHaveBeenCalled()

    h.path.value = '/wallets'
    rerender(<PasskeySetupPromptHost />)

    expect(await screen.findByRole('dialog', { name: TITLE })).toBeTruthy()
  })

  it('stays away for a user who already has a passkey', async () => {
    markJustSignedIn('u1')
    h.list.mockResolvedValue([{ id: 'p1' }])
    render(<PasskeySetupPromptHost />)
    await settle()

    expect(h.list).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stays away on a device that cannot hold a passkey', async () => {
    markJustSignedIn('u1')
    h.platform.mockResolvedValue(false)
    render(<PasskeySetupPromptHost />)
    await settle()

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('waits for a connection', async () => {
    markJustSignedIn('u1')
    setOnline(false)
    render(<PasskeySetupPromptHost />)
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()

    setOnline(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(await screen.findByRole('dialog', { name: TITLE })).toBeTruthy()
  })

  it('stays away once dismissed on this device', async () => {
    markJustSignedIn('u1')
    localStorage.setItem(DISMISSED, '1')
    render(<PasskeySetupPromptHost />)
    await settle()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.list).not.toHaveBeenCalled()
  })

  it('remembers “Not now” for this user on this device', async () => {
    markJustSignedIn('u1')
    render(<PasskeySetupPromptHost />)
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(localStorage.getItem(DISMISSED)).toBe('1')
  })

  it('sets a passkey up without asking for the password again', async () => {
    markJustSignedIn('u1')
    h.options.mockResolvedValue({ options: { challenge: 'c' }, state: 's' })
    h.startRegistration.mockResolvedValue({ id: 'cred' })
    h.verify.mockResolvedValue({ id: 'p1' })
    render(<PasskeySetupPromptHost />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Set up a passkey' }),
    )

    expect(
      await screen.findByRole('dialog', { name: 'Your passkey is set up' }),
    ).toBeTruthy()
    expect(h.options).toHaveBeenCalledWith(undefined)
    expect(h.verify).toHaveBeenCalledWith({
      state: 's',
      credential: { id: 'cred' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(localStorage.getItem(DISMISSED)).toBe('1')
  })
})
