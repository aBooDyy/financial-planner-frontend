// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
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
import { ApiError } from '#/lib/apiError'
import { useSessionStore } from '#/stores/session'
import { AuthScreen } from './AuthScreen'

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  options: vi.fn(),
  verify: vi.fn(),
  startAuthentication: vi.fn(),
  autofill: vi.fn(),
  cancelCeremony: vi.fn(),
  supported: { value: true },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => h.navigate,
}))

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => h.supported.value,
  browserSupportsWebAuthnAutofill: () => h.autofill(),
  platformAuthenticatorIsAvailable: async () => true,
  startAuthentication: (args: unknown) => h.startAuthentication(args),
  WebAuthnAbortService: { cancelCeremony: () => h.cancelCeremony() },
}))

vi.mock('#/features/passkeys/api/passkeysApi', () => ({
  passkeysApi: {
    authenticationOptions: () => h.options(),
    authenticationVerify: (payload: unknown) => h.verify(payload),
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
const OPTIONS = { challenge: 'c', allowCredentials: [] }
const CREDENTIAL = { id: 'cred', response: {} }

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })

const named = (name: string, message: string) => {
  const error = new Error(message)
  error.name = name
  return error
}

const passkeyButton = () =>
  screen.getByRole('button', { name: 'Sign in with a passkey' })

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  h.supported.value = true
  h.autofill.mockResolvedValue(false)
  h.options.mockResolvedValue({ options: OPTIONS, state: 'signed-state' })
  h.startAuthentication.mockResolvedValue(CREDENTIAL)
  h.verify.mockResolvedValue(USER)
  sessionStorage.clear()
  localStorage.clear()
  useSessionStore.setState({ status: 'anonymous', user: null, verified: false })
})

afterEach(() => {
  cleanup()
  setOnline(true)
})

describe('the passkey button', () => {
  it('signs in and lands on the app like a password sign-in', async () => {
    render(<AuthScreen mode="login" />)
    fireEvent.click(passkeyButton())

    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ to: '/' }))
    expect(h.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: OPTIONS,
      useBrowserAutofill: false,
    })
    expect(h.verify).toHaveBeenCalledWith({
      state: 'signed-state',
      credential: CREDENTIAL,
    })
    expect(useSessionStore.getState().user).toEqual(USER)
  })

  it('does not lead to the passkey setup offer', async () => {
    render(<AuthScreen mode="login" />)
    fireEvent.click(passkeyButton())

    await waitFor(() => expect(h.navigate).toHaveBeenCalled())
    expect(sessionStorage.getItem('fp:passkey-just-signed-in')).toBeNull()
  })

  it('drops the email field’s autofill request before starting its own', async () => {
    render(<AuthScreen mode="login" />)
    fireEvent.click(passkeyButton())

    await waitFor(() => expect(h.options).toHaveBeenCalled())
    expect(h.cancelCeremony.mock.invocationCallOrder[0]).toBeLessThan(
      h.options.mock.invocationCallOrder[0],
    )
  })

  it('says nothing when the user closes the passkey sheet', async () => {
    h.startAuthentication.mockRejectedValue(
      named('NotAllowedError', 'The operation was not allowed.'),
    )
    render(<AuthScreen mode="login" />)
    fireEvent.click(passkeyButton())

    await waitFor(() =>
      expect(passkeyButton()).toHaveProperty('disabled', false),
    )
    expect(h.startAuthentication).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(h.verify).not.toHaveBeenCalled()
  })

  it('points to the password when the server does not know the passkey', async () => {
    h.verify.mockRejectedValue(
      new ApiError({ code: 'auth.passkey.invalid', message: '', status: 401 }),
    )
    render(<AuthScreen mode="login" />)
    fireEvent.click(passkeyButton())

    expect((await screen.findByRole('alert')).textContent).toBe(
      'That passkey isn’t recognised. Sign in with your password.',
    )
    expect(useSessionStore.getState().user).toBeNull()
  })

  it('shows pending text while it runs', async () => {
    h.startAuthentication.mockReturnValue(new Promise(() => undefined))
    render(<AuthScreen mode="login" />)
    fireEvent.click(passkeyButton())

    expect(
      await screen.findByRole('button', { name: 'Signing in…' }),
    ).toHaveProperty('disabled', true)
  })

  it('is held while offline', () => {
    setOnline(false)
    render(<AuthScreen mode="login" />)
    expect(passkeyButton()).toHaveProperty('disabled', true)
  })

  it('is not offered where the browser has no WebAuthn', () => {
    h.supported.value = false
    render(<AuthScreen mode="login" />)
    expect(screen.queryByRole('button', { name: /passkey/ })).toBeNull()
  })

  it('is not offered when creating an account', () => {
    render(<AuthScreen mode="signup" />)
    expect(screen.queryByRole('button', { name: /passkey/ })).toBeNull()
  })
})

describe('passkey autofill on the email field', () => {
  it('marks the field for passkeys', () => {
    render(<AuthScreen mode="login" />)
    expect(
      screen.getByLabelText('Email address').getAttribute('autocomplete'),
    ).toBe('username webauthn')
  })

  it('signs in with the passkey picked from the field', async () => {
    h.autofill.mockResolvedValue(true)
    render(<AuthScreen mode="login" />)

    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ to: '/' }))
    expect(h.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: OPTIONS,
      useBrowserAutofill: true,
    })
    expect(useSessionStore.getState().user).toEqual(USER)
  })

  it('is dropped when the form goes away', async () => {
    h.autofill.mockResolvedValue(true)
    h.startAuthentication.mockReturnValue(new Promise(() => undefined))
    const { unmount } = render(<AuthScreen mode="login" />)
    await waitFor(() => expect(h.startAuthentication).toHaveBeenCalled())
    h.cancelCeremony.mockClear()

    unmount()
    expect(h.cancelCeremony).toHaveBeenCalled()
  })

  it('stays quiet when its request is aborted', async () => {
    h.autofill.mockResolvedValue(true)
    h.startAuthentication.mockRejectedValue(
      named('AbortError', 'Cancelling existing WebAuthn API call for new one'),
    )
    render(<AuthScreen mode="login" />)

    await waitFor(() => expect(h.startAuthentication).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('is not started where the browser has no passkey autofill', async () => {
    render(<AuthScreen mode="login" />)
    await waitFor(() => expect(h.autofill).toHaveBeenCalled())
    expect(h.options).not.toHaveBeenCalled()
  })
})
