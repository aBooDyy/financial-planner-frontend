// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import {
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
import { db } from '#/db/db'
import { catId } from '#/features/categories/__fixtures__/categories'
import { billOwner, goalOwner } from '#/features/planned/data/owners'
import {
  bill,
  goal,
  m,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { usePlanningToast } from '#/features/planning/stores/toast'
import { AddMoneySheet } from './AddMoneySheet'
import { LeftoverSheet } from './LeftoverSheet'
import { MarkDoneSheet } from './MarkDoneSheet'
import { PayNowSheet } from './PayNowSheet'
import { UseItSheet } from './UseItSheet'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

beforeAll(stubBrowser)

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2))
  await seedPlanningDb()
  await db.balanceNodes.put(
    wallet({ id: 'savings', name: 'Savings', amount: m(5000), position: 1 }),
  )
  await db.goals.put(
    goal({
      id: 'umrah',
      name: 'Umrah',
      target: m(13000),
      dueDate: '2027-06-30',
      saveWalletId: 'main',
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const toastText = () => usePlanningToast.getState().toast?.message

describe('Add money', () => {
  it('sets money aside in one wallet', async () => {
    const onClose = vi.fn()
    render(<AddMoneySheet owner={goalOwner('umrah')} onClose={onClose} />)
    fireEvent.change(await screen.findByLabelText('How much?'), {
      target: { value: '500' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set aside SR 500' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const [made] = await db.setAsides.toArray()
    expect(made).toMatchObject({
      goalId: 'umrah',
      walletId: 'main',
      amount: m(500),
      releasedAt: null,
    })
    expect(toastText()).toBe('SR 500 set aside for Umrah')
  })

  it('starts from a wallet and asks which bill or goal the money is for', async () => {
    await db.bills.put(
      bill({ id: 'rent', name: 'Rent', nextDue: '2026-11-01' }),
    )
    const onClose = vi.fn()
    render(<AddMoneySheet owner={null} walletId="savings" onClose={onClose} />)
    expect(
      await screen.findByRole('heading', { name: 'Set aside in Savings' }),
    ).toBeTruthy()
    fireEvent.change(screen.getByLabelText('How much?'), {
      target: { value: '300' },
    })
    expect(screen.getAllByText('Pick a bill or goal').length).toBe(2)
    fireEvent.click(screen.getByRole('combobox', { name: 'For' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Rent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set aside SR 300' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((await db.setAsides.toArray())[0]).toMatchObject({
      billId: 'rent',
      walletId: 'savings',
      amount: m(300),
    })
  })

  it('warns before over-committing a wallet, and sets aside anyway', async () => {
    const onClose = vi.fn()
    render(<AddMoneySheet owner={goalOwner('umrah')} onClose={onClose} />)
    fireEvent.change(await screen.findByLabelText('How much?'), {
      target: { value: '6000' },
    })
    fireEvent.click(screen.getByRole('radio', { name: /Savings/ }))
    expect(
      await screen.findByText(
        'Savings has SR 5,000 free. Setting aside SR 6,000 leaves it SR 1,000 over-committed.',
      ),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set aside anyway' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((await db.setAsides.toArray())[0]).toMatchObject({
      walletId: 'savings',
      amount: m(6000),
    })
  })

  it('splits across wallets once the parts add up', async () => {
    const onClose = vi.fn()
    render(<AddMoneySheet owner={goalOwner('umrah')} onClose={onClose} />)
    fireEvent.change(await screen.findByLabelText('How much?'), {
      target: { value: '1000' },
    })
    fireEvent.click(
      screen.getByRole('switch', { name: /Split across wallets/ }),
    )
    fireEvent.change(screen.getByLabelText('Amount 1'), {
      target: { value: '600' },
    })
    expect(screen.getByText('SR 400 left to place')).toBeTruthy()
    expect(screen.getByText('The split has to add up')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove wallet 2' }))
    fireEvent.change(screen.getByLabelText('Amount 1'), {
      target: { value: '1000' },
    })
    expect(screen.getByText('Adds up')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set aside SR 1,000' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.setAsides.count()).toBe(1)
  })
})

describe('Pay now and the leftover prompt', () => {
  beforeEach(async () => {
    await db.bills.put(
      bill({
        id: 'ins',
        name: 'Car insurance',
        amount: m(1200),
        frequency: 'annual',
        nextDue: '2027-03-01',
        walletId: 'main',
      }),
    )
    await db.setAsides.bulkPut([
      setAside({
        id: 'sa-main',
        goalId: null,
        billId: 'ins',
        occurrence: '2027-03-01',
        walletId: 'main',
        amount: m(800),
      }),
      setAside({
        id: 'sa-sav',
        goalId: null,
        billId: 'ins',
        occurrence: '2027-03-01',
        walletId: 'savings',
        amount: m(300),
      }),
    ])
  })

  it('says where the payment comes from and hands over the leftover', async () => {
    const onLeftover = vi.fn()
    render(
      <PayNowSheet billId="ins" onClose={vi.fn()} onLeftover={onLeftover} />,
    )
    expect(await screen.findByText('SR 1,200 leaves Main bank.')).toBeTruthy()
    expect(
      screen.getByText(
        'SR 800 comes from what you set aside, SR 400 from free money.',
      ),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Record SR 1,200 payment' }),
    )
    await waitFor(() => expect(onLeftover).toHaveBeenCalled())
    const [report, paying] = onLeftover.mock.calls[0]
    expect(paying).toBe('main')
    expect(report.lines).toMatchObject([
      { walletId: 'savings', amount: m(300) },
    ])
    const payment = (await db.transactions.toArray())[0]
    expect(payment).toMatchObject({ billId: 'ins', amount: m(1200) })
    expect((await db.setAsides.get('sa-main'))?.releasedAt).not.toBeNull()
  })

  it('frees the leftover where it is', async () => {
    const onClose = vi.fn()
    render(
      <LeftoverSheet
        report={{
          billId: 'ins',
          occurrence: '2027-03-01',
          lines: [
            {
              walletId: 'savings',
              externalLabel: null,
              amount: m(300),
              currency: 'SAR',
              ids: ['sa-sav'],
            },
          ],
          total: m(300),
          canKeep: true,
          nextOccurrence: '2028-03-01',
        }}
        payingWalletId="main"
        date="2026-10-02"
        onClose={onClose}
      />,
    )
    expect(
      await screen.findByRole('button', { name: 'Move it to Main bank' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Keep it for next time' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Free it up' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((await db.setAsides.get('sa-sav'))?.releasedAt).toBe('2026-10-02')
    expect(toastText()).toBe('SR 300 is free to spend')
  })
})

describe('Mark as done', () => {
  beforeEach(async () => {
    await db.setAsides.put(
      setAside({
        id: 'held',
        goalId: 'umrah',
        walletId: 'main',
        amount: m(2000),
      }),
    )
  })

  it('records "I spent it" and closes the goal', async () => {
    const onClose = vi.fn()
    render(<MarkDoneSheet owner={goalOwner('umrah')} onClose={onClose} />)
    expect(
      await screen.findByText('What happens to the SR 2,000 set aside?'),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('radio', { name: /I spent it/ })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.getByText('Pick what it was spent on')).toBeTruthy()
    await db.goals.update('umrah', { useCategoryId: catId('travel') })
    cleanup()
    render(<MarkDoneSheet owner={goalOwner('umrah')} onClose={onClose} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as done' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((await db.goals.get('umrah'))?.closedAt).not.toBeNull()
    expect((await db.transactions.toArray())[0]).toMatchObject({
      goalId: 'umrah',
      amount: m(2000),
      categoryId: catId('travel'),
    })
  })

  it('moves the money to another goal', async () => {
    await db.goals.put(goal({ id: 'car', name: 'New car', amount: m(500) }))
    const onClose = vi.fn()
    render(<MarkDoneSheet owner={goalOwner('umrah')} onClose={onClose} />)
    fireEvent.click(
      await screen.findByRole('radio', { name: /Move it to another/ }),
    )
    expect(screen.getByText('Pick where the money goes')).toBeTruthy()
    fireEvent.click(screen.getByRole('combobox', { name: 'Move to' }))
    fireEvent.click(await screen.findByRole('option', { name: 'New car' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const live = (await db.setAsides.toArray()).filter(
      (a) => a.releasedAt === null,
    )
    expect(live).toMatchObject([{ goalId: 'car', amount: m(2000) }])
  })

  it('ends a repeating bill', async () => {
    await db.bills.put(bill({ id: 'gym', name: 'Gym', walletId: 'main' }))
    const onClose = vi.fn()
    render(<MarkDoneSheet owner={billOwner('gym')} onClose={onClose} />)
    expect(await screen.findByRole('heading', { name: 'End Gym' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'End this bill' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((await db.bills.get('gym'))?.closedAt).not.toBeNull()
    expect(toastText()).toBe('Gym is done')
  })
})

describe('Use it', () => {
  it('asks for the category the first time and remembers it', async () => {
    const onClose = vi.fn()
    render(<UseItSheet goalId="umrah" onClose={onClose} />)
    fireEvent.change(await screen.findByLabelText('How much did you spend?'), {
      target: { value: '250' },
    })
    expect(screen.getByText('Pick what it was spent on')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Record SR 250 spent' }),
    ).toBeTruthy()
  })
})
