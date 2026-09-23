import { useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { LocalBalanceNode } from '#/db/types'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { TxType } from '#/features/transactions/api/types'
import type { EditorTxType } from '#/features/transactions/hooks/useTxEditor'
import { createTransaction } from '#/features/transactions/data/mutations'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import type { RatesMap } from '#/lib/config/rates'
import { amountInputProps, parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { Button } from '#/components/ui/button'
import { Icon } from '#/components/icons/Icon'
import { CategoryPickerDialog } from './CategoryPickerDialog'
import { QuickTransferForm } from './QuickTransferForm'

type Props = {
  walletId: string | null
  currency: CurrencyCode
  symbol: string
  wallets: LocalBalanceNode[]
  base: CurrencyCode
  rates: RatesMap
}

const TABS: ReadonlyArray<{ type: EditorTxType; label: string }> = [
  { type: 'spend', label: 'Spend' },
  { type: 'income', label: 'Income' },
  { type: 'transfer', label: 'Transfer' },
]

const typeBtn = (active: boolean) =>
  `whitespace-nowrap rounded-[8px] px-[11px] py-[6px] text-[12.5px] ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

export function QuickAddCard({
  walletId,
  currency,
  symbol,
  wallets,
  base,
  rates,
}: Props) {
  const catalog = useCategoryCatalog()
  const [tab, setTab] = useState<EditorTxType>('spend')
  const [type, setType] = useState<TxType>('spend')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState(
    () => catalog.byType('spend')[0]?.slug ?? 'other',
  )
  const [pickerOpen, setPickerOpen] = useState(false)

  const switchTab = (next: EditorTxType) => {
    setTab(next)
    if (next !== 'transfer') switchType(next)
  }

  const switchType = (next: TxType) => {
    setType(next)
    const valid = catalog.byType(next).map((c) => c.slug)
    if (!valid.includes(category)) setCategory(valid[0])
  }

  const add = async () => {
    if (!walletId) return
    const minor = parseAmountToMinor(amount, currency)
    if (!minor || minor <= 0) return
    await createTransaction({
      type,
      amount: minor,
      currency,
      category,
      subcategory: null,
      walletId,
      goalId: null,
      date: ymd(startOfToday()),
      note: note.trim() || null,
    })
    setAmount('')
    setNote('')
  }

  const first = catalog.byType(type).slice(0, 3)
  const selectedInChips = first.some((c) => c.slug === category)
  const selectedCat = catalog.get(category)

  const chip = (active: boolean) =>
    `inline-flex items-center gap-[6px] whitespace-nowrap rounded-full border px-[11px] py-[7px] text-[12px] font-semibold ${
      active ? '' : 'border-fp-border bg-fp-surface-2 text-fp-text-2'
    }`

  return (
    <div className="rounded-[18px] border border-fp-accent bg-fp-surface p-4 shadow-fp">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="whitespace-nowrap text-[15px] font-extrabold">
          Quick add
        </span>
        <div className="inline-flex flex-none rounded-[10px] border border-fp-border bg-fp-surface-2 p-[3px]">
          {TABS.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => switchTab(t.type)}
              className={typeBtn(tab === t.type)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'transfer' ? (
        <QuickTransferForm wallets={wallets} base={base} rates={rates} />
      ) : (
        <>
          <div className="mb-[11px] flex items-stretch gap-2">
            <div className="flex flex-none items-center gap-[6px] rounded-[11px] border border-fp-border-strong bg-fp-surface-2 px-[11px] focus-within:border-fp-accent">
              <span className="text-[14px] font-bold text-fp-text-3">
                {symbol}
              </span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                {...amountInputProps(currency)}
                className="w-[78px] border-none bg-transparent py-[11px] text-[18px] font-extrabold tabular-nums text-fp-text outline-none"
              />
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                type === 'income' ? 'Note — e.g. Salary' : 'What was it for?'
              }
              className="min-w-0 flex-1 rounded-[11px] border border-fp-border-strong bg-fp-surface-2 px-3 text-[13.5px] text-fp-text outline-none focus:border-fp-accent"
            />
            <Button
              type="button"
              onClick={() => void add()}
              title="Add"
              className="w-[46px] flex-none rounded-[11px] px-0 py-0 text-white [&_svg]:size-5"
            >
              <Plus size={20} strokeWidth={2.4} />
            </Button>
          </div>

          <div className="flex flex-wrap gap-[6px]">
            {first.map((c) => {
              const active = c.slug === category
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setCategory(c.slug)}
                  className={chip(active)}
                  style={
                    active
                      ? {
                          borderColor: c.color,
                          background: `${c.color}1A`,
                          color: c.color,
                        }
                      : undefined
                  }
                >
                  <Icon id={c.icon} size={15} />
                  <span>{c.name}</span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={chip(!selectedInChips)}
              style={
                !selectedInChips
                  ? {
                      borderColor: selectedCat.color,
                      background: `${selectedCat.color}1A`,
                      color: selectedCat.color,
                    }
                  : undefined
              }
            >
              {selectedInChips ? (
                <MoreHorizontal size={15} strokeWidth={1.9} />
              ) : (
                <Icon id={selectedCat.icon} size={15} />
              )}
              <span>{selectedInChips ? 'More' : selectedCat.name}</span>
            </button>
          </div>
        </>
      )}

      {pickerOpen ? (
        <CategoryPickerDialog
          type={type}
          selected={category}
          allowSubcategory={false}
          onSelect={(id) => {
            setCategory(id)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  )
}
