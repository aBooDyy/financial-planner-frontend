import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { LocalBalanceNode } from '#/db/types'
import { DELETED_CATEGORY_ID } from '#/features/categories/data/catalog'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { TxType } from '#/features/transactions/api/types'
import type { EditorTxType } from '#/features/transactions/hooks/useTxEditor'
import { createTransaction } from '#/features/transactions/data/mutations'
import { quickAddTarget } from '#/features/transactions/data/quickAddMatch'
import { useQuickAddMatch } from '#/features/transactions/hooks/useQuickAddMatch'
import { useQuickChips } from '#/features/transactions/hooks/useQuickChips'
import type { QuickChip } from '#/features/transactions/data/quickChips'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import type { RatesMap } from '#/lib/config/rates'
import { amountInputProps, parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Button } from '#/components/ui/button'
import { QuickAddMatchHint } from './QuickAddMatchHint'
import { QuickCategoryChips } from './QuickCategoryChips'
import { QuickTransferForm } from './QuickTransferForm'

type Props = {
  walletId: string | null
  currency: CurrencyCode
  /** `null` while the wallet it comes from is still loading. */
  symbol: string | null
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
  // Until the user picks, the entry files under their most-used category for this type.
  const [picked, setPicked] = useState<QuickChip | null>(null)
  const chips = useQuickChips(type, undefined, {
    minor: parseAmountToMinor(amount, currency),
    currency,
  })
  const categoryId =
    (picked ?? chips.at(0))?.categoryId ??
    catalog.fallbackFor(type)?.id ??
    DELETED_CATEGORY_ID
  const match = useQuickAddMatch({ type, amount, currency })

  const switchTab = (next: EditorTxType) => {
    setTab(next)
    if (next !== 'transfer') switchType(next)
  }

  const switchType = (next: TxType) => {
    if (next !== type) setPicked(null)
    setType(next)
  }

  const chooseCategory = (next: string) => setPicked({ categoryId: next })

  const add = async () => {
    const minor = parseAmountToMinor(amount, currency)
    if (!minor || minor <= 0) return
    const { link } = match
    const target = quickAddTarget({
      amount: minor,
      currency,
      walletId,
      plannedWallet: link?.wallet ?? null,
      rates: match.rates,
    })
    if (!target) return
    await createTransaction({
      type,
      ...target,
      categoryId,
      goalId: link?.goalId ?? null,
      billId: link?.billId ?? null,
      plannedId: link?.plannedId ?? null,
      date: ymd(startOfToday()),
      note: note.trim() || link?.name || null,
    })
    setAmount('')
    setNote('')
  }

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
                <ValueOrSkeleton value={symbol} className="h-3.5 w-5" />
              </span>
              <input
                {...amountInputProps(currency, amount, setAmount)}
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

          {match.hint ? (
            <QuickAddMatchHint
              hint={match.hint}
              linked={match.linked}
              onLinkedChange={match.setLinked}
            />
          ) : null}

          <QuickCategoryChips
            type={type}
            chips={chips}
            categoryId={categoryId}
            onChange={chooseCategory}
          />
        </>
      )}
    </div>
  )
}
