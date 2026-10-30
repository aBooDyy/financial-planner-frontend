// @vitest-environment jsdom
import 'fake-indexeddb/auto'
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
import { db } from '#/db/db'
import { catId } from '#/features/categories/__fixtures__/categories'
import { billOwner, goalOwner } from '#/features/planned/data/owners'
import {
  bill,
  goal,
  m,
  setAside,
  tx,
  wallet,
} from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { usePlanningToast } from '#/features/planning/stores/toast'
import { AddMoneySheet } from './AddMoneySheet'
import { LeftoverSheet } from './LeftoverSheet'
import { MarkDoneSheet } from './MarkDoneSheet'
import { PayNowSheet } from './PayNowSheet'
import { SetAsideSheet } from './SetAsideSheet'
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

  const spends = async () =>
    (await db.transactions.toArray())
      .map((t) => [t.walletId, t.amount / 100])
      .sort()

  it('spends only what the paying wallet holds, and frees the rest', async () => {
    await db.goals.update('umrah', { useCategoryId: catId('travel') })
    await db.setAsides.put(
      setAside({ goalId: 'umrah', walletId: 'savings', amount: m(500) }),
    )
    const onClose = vi.fn()
    render(<MarkDoneSheet owner={goalOwner('umrah')} onClose={onClose} />)
    expect(
      (
        await screen.findByLabelText<HTMLInputElement>(
          'How much did you spend?',
        )
      ).value,
    ).toBe('2,000.00')
    expect(
      screen.getByText('The other SR 500 set aside is freed.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await spends()).toEqual([['main', 2000]])
    expect(
      (await db.setAsides.toArray()).filter((a) => a.releasedAt === null),
    ).toEqual([])
  })

  it('records what each wallet paid when it was paid from several', async () => {
    await db.goals.update('umrah', { useCategoryId: catId('travel') })
    await db.setAsides.put(
      setAside({ goalId: 'umrah', walletId: 'savings', amount: m(500) }),
    )
    const onClose = vi.fn()
    render(<MarkDoneSheet owner={goalOwner('umrah')} onClose={onClose} />)
    fireEvent.click(
      await screen.findByRole('switch', { name: /Paid from several wallets/ }),
    )
    expect(screen.getByLabelText<HTMLInputElement>('Amount 1').value).toBe(
      '2,000.00',
    )
    expect(screen.getByLabelText<HTMLInputElement>('Amount 2').value).toBe(
      '500.00',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await spends()).toEqual([
      ['main', 2000],
      ['savings', 500],
    ])
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

describe('SetAsideSheet', () => {
  const held = (over = {}) =>
    setAside({
      id: 'sa',
      goalId: 'g1',
      walletId: 'main',
      amount: m(200),
      date: '2026-09-01',
      ...over,
    })

  beforeEach(async () => {
    await db.goals.put(goal({ id: 'g1', name: 'Car', amount: m(300) }))
  })

  it('saves a change to a live one', async () => {
    await db.setAsides.put(held())
    render(<SetAsideSheet id="sa" onClose={vi.fn()} />)
    const amount = await screen.findByRole('textbox', { name: /How much/ })
    fireEvent.change(amount, { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () =>
      expect((await db.setAsides.get('sa'))?.amount).toBe(m(250)),
    )
  })

  it('takes a live one back, keeping the record', async () => {
    await db.setAsides.put(held())
    render(<SetAsideSheet id="sa" onClose={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Take back' }))
    await waitFor(async () =>
      expect((await db.setAsides.get('sa'))?.releasedAt).not.toBeNull(),
    )
  })

  it('deletes one after asking', async () => {
    await db.setAsides.put(held())
    render(<SetAsideSheet id="sa" onClose={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete this set-aside?',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(async () =>
      expect(await db.setAsides.get('sa')).toBeUndefined(),
    )
  })

  it('only tells about one a payment used', async () => {
    await db.transactions.put(
      tx({ id: 'pay', goalId: 'g1', date: '2026-09-20' }),
    )
    await db.setAsides.put(
      held({ releasedAt: '2026-09-20', releasedById: 'pay' }),
    )
    render(<SetAsideSheet id="sa" onClose={vi.fn()} />)
    expect(
      await screen.findByText(/Used by the Sep 20, 2026 payment/),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Open the payment' }),
    ).toBeTruthy()
  })

  it('sets one aside again after it was taken back', async () => {
    await db.setAsides.put(held({ releasedAt: '2026-09-20' }))
    render(<SetAsideSheet id="sa" onClose={vi.fn()} />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Set aside again' }),
    )
    await waitFor(async () =>
      expect((await db.setAsides.get('sa'))?.releasedAt).toBeNull(),
    )
  })
})

describe('PayNowSheet — any date', () => {
  beforeEach(async () => {
    await db.bills.put(
      bill({
        id: 'elec',
        name: 'Electricity',
        amount: m(400),
        amountVaries: true,
        nextDue: '2026-08-15',
        walletId: 'main',
      }),
    )
  })

  it('pays the date it was opened on, in what it really came to', async () => {
    render(
      <PayNowSheet
        billId="elec"
        occurrence="2026-09-15"
        onClose={vi.fn()}
        onLeftover={vi.fn()}
      />,
    )
    const amount = await screen.findByRole('textbox', {
      name: /How much was it/,
    })
    fireEvent.change(amount, { target: { value: '437' } })
    fireEvent.click(screen.getByRole('button', { name: /^Record/ }))
    await waitFor(async () => {
      const [paid] = await db.transactions.toArray()
      expect(paid).toMatchObject({ amount: m(437), billId: 'elec' })
    })
    await waitFor(async () => {
      const rows = await db.plannedTransactions
        .where('billId')
        .equals('elec')
        .toArray()
      expect(rows.find((p) => p.occurrence === '2026-09-15')?.status).toBe(
        'done',
      )
    })
    expect((await db.bills.get('elec'))?.nextDue).toBe('2026-08-15')
  })
})
