// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import type { Passkey } from '#/features/passkeys/api/types'
import { markResumeSetup } from '#/features/passkeys/data/setupFlags'
import { stubBrowser } from '#/features/planning/testing/dom'
import { ApiError } from '#/lib/apiError'
import { useSessionStore } from '#/stores/session'
import { TooltipProvider } from '#/components/ui/tooltip'
import { SecuritySection } from './SecuritySection'

const h = vi.hoisted(() => ({
  list: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  options: vi.fn(),
  verify: vi.fn(),
  startRegistration: vi.fn(),
  googleStart: vi.fn(),
}))

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => true,
  platformAuthenticatorIsAvailable: async () => true,
  startRegistration: (args: unknown) => h.startRegistration(args),
}))

vi.mock('#/features/passkeys/api/passkeysApi', () => ({
  passkeysApi: {
    list: () => h.list(),
    rename: (id: string, payload: unknown) => h.rename(id, payload),
    remove: (id: string) => h.remove(id),
    registrationOptions: (password?: string) => h.options(password),
    registrationVerify: (payload: unknown) => h.verify(payload),
  },
}))

vi.mock('#/features/auth/hooks/useGoogleAuth', () => ({
  useGoogleAuth: () => ({ start: h.googleStart, pending: false, error: null }),
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

const passkey = (over: Partial<Passkey> = {}): Passkey => ({
  id: 'p1',
  name: 'iPhone · Safari',
  providerName: 'iCloud Keychain',
  deviceType: 'mobile',
  deviceModel: 'iPhone',
  osName: 'iOS',
  osVersion: '18.1',
  browserName: 'Mobile Safari',
  browserVersion: '18.1',
  backedUp: true,
  backupEligible: true,
  transports: ['internal', 'hybrid'],
  createdAt: '2026-06-16T10:00:00Z',
  lastUsedAt: null,
  lastUsedDevice: null,
  updatedAt: '2026-06-16T10:00:00Z',
  version: 'v1',
  ...over,
})

const reauthRequired = () =>
  new ApiError({ code: 'auth.reauth.required', message: '', status: 403 })

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })

const renderSection = () =>
  render(
    <TooltipProvider>
      <SecuritySection />
    </TooltipProvider>,
  )

const addButton = () => screen.getByRole('button', { name: 'Add a passkey' })

const signInAs = (over: Partial<User> = {}) =>
  useSessionStore.setState({
    status: 'authenticated',
    user: { ...USER, ...over },
    verified: true,
  })

beforeAll(stubBrowser)

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  localStorage.clear()
  signInAs()
  h.list.mockResolvedValue([passkey()])
  h.options.mockResolvedValue({ options: { challenge: 'c' }, state: 's' })
  h.startRegistration.mockResolvedValue({ id: 'cred' })
  h.verify.mockResolvedValue(
    passkey({ id: 'p2', name: 'Mac · Chrome', backedUp: false }),
  )
})

afterEach(() => {
  cleanup()
  setOnline(true)
})

describe('Settings › Sign-in & security', () => {
  it('holds the rows’ places while the list loads', async () => {
    h.list.mockReturnValue(new Promise(() => undefined))
    renderSection()

    expect(screen.getByLabelText('Loading passkeys')).toBeTruthy()
    expect(screen.getByText('Sign-in & security')).toBeTruthy()
  })

  it('tells each passkey apart', async () => {
    h.list.mockResolvedValue([
      passkey({
        lastUsedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        lastUsedDevice: 'iPhone · Safari',
      }),
      passkey({
        id: 'p2',
        name: 'Work laptop',
        providerName: null,
        deviceType: 'desktop',
        deviceModel: null,
        osName: 'Windows',
        osVersion: '11',
        browserName: 'Edge',
        backedUp: false,
      }),
    ])
    renderSection()

    const rows = within(
      await screen.findByRole('list', { name: 'Passkeys' }),
    ).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('iPhone · Safari')
    expect(rows[0].textContent).toContain(
      'iCloud Keychain · iPhone · iOS 18.1 · Safari',
    )
    expect(rows[0].textContent).toContain('Synced')
    expect(rows[0].textContent).toContain(
      'Added 16/06/2026 · Last used 2 days ago on iPhone · Safari',
    )
    expect(rows[1].textContent).toContain('Windows 11 · Edge')
    expect(rows[1].textContent).not.toContain('Synced')
    expect(rows[1].textContent).toContain('Never used')
  })

  it('explains passkeys when there are none', async () => {
    h.list.mockResolvedValue([])
    renderSection()

    expect(await screen.findByText('No passkeys yet')).toBeTruthy()
  })

  it('renames a passkey against the version it showed', async () => {
    h.rename.mockResolvedValue(passkey({ name: 'My phone', version: 'v2' }))
    renderSection()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Rename iPhone · Safari' }),
    )
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: '  My phone ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('My phone')).toBeTruthy())
    expect(h.rename).toHaveBeenCalledWith('p1', {
      name: 'My phone',
      version: 'v1',
    })
  })

  it('reloads the list when a rename lost to another change', async () => {
    h.rename.mockRejectedValue(
      new ApiError({ code: 'common.conflict', message: '', status: 409 }),
    )
    renderSection()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Rename iPhone · Safari' }),
    )
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'My phone' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText(
        'This was changed elsewhere — reload and try again.',
      ),
    ).toBeTruthy()
    expect(h.list).toHaveBeenCalledTimes(2)
  })

  it('removes a passkey once confirmed', async () => {
    h.remove.mockResolvedValue(undefined)
    renderSection()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove iPhone · Safari' }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Remove this passkey?' }),
    ).toBeTruthy()
    expect(h.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() =>
      expect(screen.getByText('No passkeys yet')).toBeTruthy(),
    )
    expect(h.remove).toHaveBeenCalledWith('p1')
  })

  it('adds a passkey straight away on a fresh session', async () => {
    renderSection()
    await screen.findByText('iPhone · Safari')

    fireEvent.click(addButton())

    expect(
      await screen.findByRole('dialog', { name: 'Your passkey is set up' }),
    ).toBeTruthy()
    expect(h.options).toHaveBeenCalledWith(undefined)
    expect(h.verify).toHaveBeenCalledWith({
      state: 's',
      credential: { id: 'cred' },
    })
    expect(screen.getByText('Mac · Chrome')).toBeTruthy()
  })

  it('says nothing when the passkey sheet is closed', async () => {
    const closed = new Error('Not allowed')
    closed.name = 'NotAllowedError'
    h.startRegistration.mockRejectedValue(closed)
    renderSection()
    await screen.findByText('iPhone · Safari')

    fireEvent.click(addButton())

    await waitFor(() => expect(addButton()).toHaveProperty('disabled', false))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks for the password when the session is no longer fresh', async () => {
    h.options
      .mockRejectedValueOnce(reauthRequired())
      .mockRejectedValueOnce(
        new ApiError({
          code: 'auth.credentials.invalid',
          message: '',
          status: 401,
        }),
      )
      .mockResolvedValueOnce({ options: { challenge: 'c' }, state: 's' })
    renderSection()
    await screen.findByText('iPhone · Safari')

    fireEvent.click(addButton())
    await screen.findByRole('dialog', { name: 'Confirm it’s you' })

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(
      await screen.findByText('That password isn’t right. Try again.'),
    ).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'right' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByRole('dialog', { name: 'Your passkey is set up' }),
    ).toBeTruthy()
    expect(h.options).toHaveBeenNthCalledWith(2, 'wrong')
    expect(h.options).toHaveBeenNthCalledWith(3, 'right')
  })

  it('re-verifies with Google for an account with no password', async () => {
    signInAs({ hasPassword: false })
    h.options.mockRejectedValueOnce(reauthRequired())
    renderSection()
    await screen.findByText('iPhone · Safari')

    fireEvent.click(addButton())
    await screen.findByRole('dialog', { name: 'Confirm it’s you' })
    expect(screen.queryByLabelText('Password')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Verify with Google' }))

    expect(h.googleStart).toHaveBeenCalled()
    expect(sessionStorage.getItem('fp:passkey-resume-setup')).not.toBeNull()
  })

  it('carries setup on after coming back from Google', async () => {
    markResumeSetup()
    renderSection()

    const dialog = await screen.findByRole('dialog', {
      name: 'Finish adding your passkey',
    })
    expect(sessionStorage.getItem('fp:passkey-resume-setup')).toBeNull()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Set up a passkey' }),
    )

    expect(
      await screen.findByRole('dialog', { name: 'Your passkey is set up' }),
    ).toBeTruthy()
  })

  it('holds every change while offline', async () => {
    setOnline(false)
    renderSection()

    expect(screen.getByRole('status').textContent).toMatch(/offline/)
    expect(addButton()).toHaveProperty('disabled', true)
    expect(h.list).not.toHaveBeenCalled()
  })

  it('keeps the list it has when the connection drops', async () => {
    renderSection()
    await screen.findByText('iPhone · Safari')

    setOnline(false)
    fireEvent(window, new Event('offline'))

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Rename iPhone · Safari' }),
      ).toHaveProperty('disabled', true),
    )
    expect(
      screen.getByRole('button', { name: 'Remove iPhone · Safari' }),
    ).toHaveProperty('disabled', true)
  })
})
