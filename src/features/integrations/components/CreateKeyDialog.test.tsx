// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { aKey } from '#/features/integrations/__fixtures__/keys'
import { CreateKeyDialog } from './CreateKeyDialog'

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})

afterEach(cleanup)

const renderCreate = (
  props: Partial<Parameters<typeof CreateKeyDialog>[0]> = {},
) => {
  const create = props.create ?? vi.fn()
  const onCreated = props.onCreated ?? vi.fn()
  render(
    <CreateKeyDialog
      open
      initialName=""
      online
      walletGroups={[{ label: null, wallets: [{ id: 'w1', name: 'Visa' }] }]}
      create={create}
      onCreated={onCreated}
      onClose={vi.fn()}
      {...props}
    />,
  )
  return { create, onCreated }
}

const createButton = () => screen.getByRole('button', { name: 'Create' })

describe('CreateKeyDialog', () => {
  it('needs a name before it can create', () => {
    renderCreate()
    expect(createButton()).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Tasker' },
    })
    expect(createButton()).toHaveProperty('disabled', false)
  })

  it('starts from an example name', () => {
    renderCreate({ initialName: 'n8n' })
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'n8n')
  })

  it('hands the created key and its token on', async () => {
    const created = { key: aKey(), token: 'fpk_7f3a9c21.s3cr3t' }
    const { create, onCreated } = renderCreate({
      initialName: '  Tasker ',
      create: vi.fn().mockResolvedValue({ ok: true, value: created }),
    })

    await act(async () => {
      fireEvent.click(createButton())
    })

    expect(create).toHaveBeenCalledWith({
      name: 'Tasker',
      expiresAt: null,
      defaultWalletId: null,
    })
    expect(onCreated).toHaveBeenCalledWith(created)
  })

  it('puts a taken name beside the name field', async () => {
    const { onCreated } = renderCreate({
      initialName: 'Tasker',
      create: vi.fn().mockResolvedValue({
        ok: false,
        failure: {
          fields: { name: 'You already have a key with that name.' },
          general: null,
        },
      }),
    })

    await act(async () => {
      fireEvent.click(createButton())
    })

    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(
      screen.getByText('You already have a key with that name.'),
    ).toBeDefined()
  })

  it('cannot create offline, and says why', () => {
    renderCreate({ initialName: 'Tasker', online: false })
    expect(createButton()).toHaveProperty('disabled', true)
    expect(
      screen.getByText('You’re offline. A key can only be made by the server.'),
    ).toBeDefined()
  })
})
