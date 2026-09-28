import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/dialog'
import { useSearchShortcut } from '#/features/search/hooks/useSearchShortcut'
import { useSearchStore } from '#/features/search/stores/search'
import { SearchPanel } from './SearchPanel'

const SHEET =
  'fixed inset-0 z-50 flex flex-col overflow-hidden bg-fp-surface pt-[env(safe-area-inset-top)] text-fp-text outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 md:inset-auto md:top-16 md:left-1/2 md:max-h-[calc(100dvh-110px)] md:w-[640px] md:max-w-[calc(100%-32px)] md:-translate-x-1/2 md:rounded-2xl md:border md:border-fp-border md:pt-0 md:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.35)]'

/**
 * The app-wide search sheet. A command-palette surface — full screen on a phone, dropped from
 * the top bar on desktop — so it styles the Radix dialog itself rather than taking
 * ResponsiveDialog's centred card and bottom drawer.
 */
export function SearchSheet() {
  const open = useSearchStore((s) => s.open)
  const closeSearch = useSearchStore((s) => s.closeSearch)
  useSearchShortcut()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeSearch()
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className={SHEET}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Search transactions, budgets, recurring items and accounts.
          </DialogDescription>
          <SearchPanel />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
