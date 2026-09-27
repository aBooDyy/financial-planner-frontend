import { useRef } from 'react'
import type { ReactNode } from 'react'
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useIsPresent,
} from 'motion/react'
import type { DragControls, PanInfo, Transition, Variants } from 'motion/react'
import { swipeStep } from '#/lib/swipe'
import type { SwipeStep } from '#/lib/swipe'
import { useDirectionStore } from '#/stores/direction'
import type { CalendarSlide } from '#/features/transactions/hooks/useCalendarSlide'

type Props = {
  slide: CalendarSlide
  /** Started by the card around it, so a swipe anywhere on the card drags the page. */
  dragControls: DragControls
  onStep: (step: SwipeStep) => void
  children: ReactNode
}

/** The side a page enters from: -1 left, 1 right, 0 in place. */
type Side = -1 | 0 | 1

const SPRING: Transition = { type: 'spring', stiffness: 320, damping: 34 }
const FADE: Transition = { duration: 0.2, ease: 'easeOut' }

const variants: Variants = {
  enter: (side: Side) =>
    side === 0 ? { x: 0, opacity: 0 } : { x: `${side * 100}%`, opacity: 1 },
  center: {
    x: 0,
    opacity: 1,
    transition: { x: SPRING, opacity: FADE },
  },
  exit: (side: Side) =>
    side === 0
      ? { opacity: 0, transition: FADE }
      : { x: `${-side * 100}%`, transition: SPRING },
}

/** A flick counts for this many seconds of its speed on top of the distance travelled. */
const FLICK_WEIGHT = 0.1

/** Pages the calendar: a new period slides in from the side it lies on, following a swipe. */
export function PeriodSlide({ slide, dragControls, onStep, children }: Props) {
  const rtl = useDirectionStore((s) => s.direction === 'rtl')
  const side = (rtl ? -slide.step : slide.step) as Side

  return (
    <MotionConfig reducedMotion="user">
      <div className="-mx-[14px] grid overflow-x-clip">
        <AnimatePresence initial={false} custom={side}>
          <Page
            key={slide.index}
            side={side}
            dragControls={dragControls}
            onRelease={(info) => {
              const step = swipeStep(
                info.offset.x + info.velocity.x * FLICK_WEIGHT,
                info.offset.y,
                rtl,
              )
              if (step !== null) onStep(step)
            }}
          >
            {children}
          </Page>
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}

function Page({
  side,
  dragControls,
  onRelease,
  children,
}: {
  side: Side
  dragControls: DragControls
  onRelease: (info: PanInfo) => void
  children: ReactNode
}) {
  const present = useIsPresent()
  // A drag that ends over a day must not also pick it.
  const dragged = useRef(false)

  return (
    <motion.div
      custom={side}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      drag={present ? 'x' : false}
      dragListener={false}
      dragControls={dragControls}
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.45}
      onDragStart={() => {
        dragged.current = true
      }}
      onDragEnd={(_, info) => onRelease(info)}
      onPointerDownCapture={() => {
        dragged.current = false
      }}
      onClickCapture={(e) => {
        if (!dragged.current) return
        dragged.current = false
        e.preventDefault()
        e.stopPropagation()
      }}
      inert={!present}
      aria-hidden={present ? undefined : true}
      className="px-[14px] [grid-area:1/1]"
    >
      {children}
    </motion.div>
  )
}
