import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { UndoToast } from '#/components/dialog/UndoToast'
import { OfflineNotice } from '#/components/OfflineNotice'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { useRefreshQueue } from '#/features/inbound-imports/hooks/useRefreshQueue'
import { useReviewQueue } from '#/features/inbound-imports/hooks/useReviewQueue'
import { useOnline } from '#/hooks/useOnline'
import { CardStack } from './CardStack'
import { ReviewCard } from './ReviewCard'

type Props = {
  imports: LocalInboundImport[]
  wallets: LocalBalanceNode[]
  onClose: () => void
  /** A source's own controls (e.g. an inbox scan), shown above the queue. */
  toolbar?: ReactNode
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

export function PendingReviewModal({
  imports,
  wallets,
  onClose,
  toolbar,
}: Props) {
  useRefreshQueue()
  const catalog = useCategoryCatalog()
  const queue = useReviewQueue(imports, wallets, catalog)
  const { count, needsCount, readyCount, card, busy } = queue
  const online = useOnline()
  // Confirming and ignoring are server calls; offline the queue can be read but not acted on.
  const locked = busy || !online
  const stackRef = useRef<HTMLDivElement>(null)
  const shownId = useRef<string | undefined>(undefined)
  const currentId = card?.item.id

  // The body scrolls as one; the next import should start at its header, not mid-email.
  useEffect(() => {
    if (shownId.current !== undefined && currentId !== undefined)
      stackRef.current?.scrollIntoView({ block: 'start' })
    shownId.current = currentId
  }, [currentId])

  const subtitle = count
    ? `${plural(count, 'import')} to review${needsCount ? ` — ${needsCount} ${needsCount === 1 ? 'needs' : 'need'} details filled in by hand` : ''}`
    : 'Nothing to review'

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="Pending auto-logged"
      description={subtitle}
      contentClassName="sm:max-w-[560px]"
      bodyClassName="gap-0 overflow-x-hidden px-0 pt-[14px] pb-0"
      footer={
        count ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            <p className="basis-full text-[12.5px] leading-[1.4] font-semibold text-fp-text-3 sm:min-w-[160px] sm:flex-1 sm:basis-auto">
              {needsCount
                ? `${needsCount} still ${needsCount === 1 ? 'needs' : 'need'} details and ${needsCount === 1 ? 'stays' : 'stay'} in the queue.`
                : 'Every import is ready to add.'}
            </p>
            <Button
              type="button"
              variant="quiet"
              size="dialog"
              onClick={queue.ignoreAll}
              disabled={locked}
              className="flex-1 sm:flex-none"
            >
              Ignore all
            </Button>
            <Button
              type="button"
              size="dialog"
              onClick={() => void queue.confirmAll()}
              disabled={locked || readyCount === 0}
              className="flex-1 sm:flex-none"
            >
              Confirm all · {readyCount}
            </Button>
          </div>
        ) : undefined
      }
    >
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-x-[10px] gap-y-2 border-y border-fp-border bg-fp-surface-2 px-5 py-[10px]">
          {toolbar}
        </div>
      ) : null}

      {online ? null : (
        <OfflineNotice className="px-5 pt-1 pb-2">
          You’re offline. Confirming or ignoring imports needs a connection —
          they’ll wait here until you’re back.
        </OfflineNotice>
      )}

      {card ? (
        <div ref={stackRef} className="scroll-mt-4 px-5 pt-4 pb-2">
          <CardStack
            itemKey={card.item.id}
            position={queue.position}
            count={count}
            onPrev={queue.prev}
            onNext={queue.next}
          >
            <ReviewCard
              key={card.item.id}
              card={card}
              wallets={wallets}
              catalog={catalog}
              busy={locked}
            />
          </CardStack>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-5 pt-11 pb-[76px] text-center">
          <div className="text-[16px] font-extrabold">All caught up</div>
          <div className="text-[13px] text-fp-text-2">
            New imports show up here after the next sync.
          </div>
        </div>
      )}

      {queue.toast ? (
        <UndoToast
          message={queue.toast.message}
          onUndo={queue.toast.undo ? queue.undo : undefined}
          className={count ? 'bottom-[136px] sm:bottom-[84px]' : 'bottom-5'}
        />
      ) : null}
    </ResponsiveDialog>
  )
}
