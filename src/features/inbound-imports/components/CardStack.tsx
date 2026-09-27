import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useDirectionStore } from '#/stores/direction'
import { SwipeCard } from './SwipeCard'
import type { SwipeMotion, SwipeTurn } from './SwipeCard'

type Props = {
  /** Identifies the card on top, so a change of card animates. */
  itemKey: string
  position: number
  count: number
  onPrev: () => void
  onNext: () => void
  children: ReactNode
}

const NAV =
  'flex size-8 items-center justify-center rounded-[10px] border-[1.5px] border-fp-border bg-fp-surface text-fp-text-2 transition hover:border-fp-border-strong hover:text-fp-text disabled:opacity-40'

/** How far past its own width a card flies before it is gone. */
const FLY_MARGIN = 80

/** The current import on top of a stack whose depth says how many wait behind it. */
export function CardStack({
  itemKey,
  position,
  count,
  onPrev,
  onNext,
  children,
}: Props) {
  const single = count < 2
  const rtl = useDirectionStore((s) => s.direction) === 'rtl'
  const stackRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState<SwipeTurn | null>(null)
  const [distance, setDistance] = useState(0)
  const [shown, setShown] = useState<{
    key: string
    turn: SwipeMotion['turn']
  }>({ key: itemKey, turn: 'none' })

  // A card that changes without a turn (confirmed, ignored) was taken off the stack.
  if (shown.key !== itemKey) {
    setShown({ key: itemKey, turn: pending ?? 'dismiss' })
    setPending(null)
  }

  const turn = (to: SwipeTurn) => {
    if (single) return
    setPending(to)
    setDistance((stackRef.current?.offsetWidth ?? 0) + FLY_MARGIN)
    if (to === 'next') onNext()
    else onPrev()
  }

  const swipe: SwipeMotion = { turn: shown.turn, lead: rtl ? 1 : -1, distance }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-[10px]">
          <span
            aria-live="polite"
            className="flex-1 text-[12.5px] font-bold text-fp-text-2"
          >
            {position + 1} of {count}
          </span>
          <button
            type="button"
            aria-label="Previous import"
            onClick={() => turn('prev')}
            disabled={single}
            className={NAV}
          >
            <ChevronLeft
              size={15}
              strokeWidth={2.2}
              className="rtl:-scale-x-100"
            />
          </button>
          <button
            type="button"
            aria-label="Next import"
            onClick={() => turn('next')}
            disabled={single}
            className={NAV}
          >
            <ChevronRight
              size={15}
              strokeWidth={2.2}
              className="rtl:-scale-x-100"
            />
          </button>
        </div>
        <div ref={stackRef} className="relative grid pb-5">
          <AnimatePresence>
            {count > 2 ? (
              <BehindCard
                key="far"
                className="inset-x-6 top-6 bottom-0 bg-fp-surface-2"
              />
            ) : null}
            {count > 1 ? (
              <BehindCard
                key="near"
                className="inset-x-3 top-3 bottom-[10px] bg-fp-surface shadow-[0_4px_10px_-6px_rgba(20,18,12,0.15)]"
              />
            ) : null}
          </AnimatePresence>
          <AnimatePresence initial={false} custom={swipe}>
            <SwipeCard
              key={itemKey}
              swipe={swipe}
              canTurn={!single}
              onTurn={turn}
            >
              {children}
            </SwipeCard>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  )
}

function BehindCard({ className }: { className: string }) {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={`absolute rounded-[18px] border-[1.5px] border-fp-border ${className}`}
    />
  )
}
