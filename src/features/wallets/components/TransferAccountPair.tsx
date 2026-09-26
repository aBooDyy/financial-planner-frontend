import { ArrowDownUp } from 'lucide-react'
import { afterTone } from '#/features/wallets/data/transferDialog'
import type {
  TransferPreview,
  TransferWallet,
} from '#/features/wallets/data/transferDialog'
import { TransferAccountCard } from './TransferAccountCard'

type Props = {
  wallets: TransferWallet[]
  from: TransferWallet
  to: TransferWallet
  preview: TransferPreview
  onFrom: (id: string) => void
  onTo: (id: string) => void
  onSwap: () => void
}

/** FROM over TO, with the round swap button sitting on the seam between them. */
export function TransferAccountPair({
  wallets,
  from,
  to,
  preview,
  onFrom,
  onTo,
  onSwap,
}: Props) {
  return (
    <div className="relative flex flex-col gap-2">
      <TransferAccountCard
        label="FROM"
        wallet={from}
        options={wallets.filter((w) => w.id !== to.id)}
        onPick={onFrom}
        showBefore={preview.hasAmount}
        after={preview.fromAfter}
        tone={afterTone(preview.hasAmount, false, preview.fromAfter)}
      />
      <button
        type="button"
        onClick={onSwap}
        title="Swap accounts"
        aria-label="Swap accounts"
        className="absolute inset-x-0 top-1/2 z-[2] mx-auto flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-fp-border bg-fp-surface text-fp-text-2 transition hover:border-fp-transfer hover:text-fp-transfer"
      >
        <ArrowDownUp size={15} strokeWidth={2} />
      </button>
      <TransferAccountCard
        label="TO"
        wallet={to}
        options={wallets.filter((w) => w.id !== from.id)}
        onPick={onTo}
        showBefore={preview.hasAmount}
        after={preview.toAfter}
        tone={afterTone(preview.hasAmount, true, preview.toAfter)}
      />
    </div>
  )
}
