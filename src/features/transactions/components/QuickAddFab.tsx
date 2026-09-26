import { Plus } from 'lucide-react'
import { useQuickAddStore } from '#/features/transactions/stores/quickAdd'

/** Desktop's floating "add transaction" button; on mobile the tab bar carries it instead. */
export function QuickAddFab() {
  const show = useQuickAddStore((s) => s.show)
  return (
    <button
      type="button"
      onClick={show}
      title="Add transaction"
      aria-label="Add transaction"
      className="fixed end-7 bottom-7 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-fp-accent text-white shadow-[0_12px_26px_-6px_var(--fp-accent)] transition-transform hover:scale-105 active:scale-95 md:flex md:[body:has([data-side-pane])_&]:hidden"
    >
      <Plus size={26} strokeWidth={2.4} />
    </button>
  )
}
