import { useRef } from 'react'
import type { ReactNode } from 'react'
import {
  motion,
  useIsPresent,
  useMotionValue,
  useTransform,
} from 'motion/react'
import type { PanInfo, Transition, Variants } from 'motion/react'

export type SwipeTurn = 'next' | 'prev'

export type SwipeMotion = {
  /** What replaced the last card: a turn either way, or it was taken off the stack. */
  turn: SwipeTurn | 'dismiss' | 'none'
  /** The side a card leaves by when turning to the next one: -1 left, 1 right. */
  lead: -1 | 1
  distance: number
}

type Props = {
  swipe: SwipeMotion
  canTurn: boolean
  onTurn: (turn: SwipeTurn) => void
  children: ReactNode
}

const SPRING: Transition = { type: 'spring', stiffness: 320, damping: 32 }
const INSTANT: Transition = { duration: 0 }
const FADE: Transition = { duration: 0.22, ease: 'easeOut' }

const IN_STACK = { x: 0, y: 14, scale: 0.94, opacity: 0 }

const variants: Variants = {
  enter: ({ turn, lead, distance }: SwipeMotion) =>
    turn === 'prev'
      ? { x: lead * distance, y: 0, scale: 1, opacity: 1, zIndex: 1 }
      : { ...IN_STACK, zIndex: 0 },
  center: {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    zIndex: 1,
    transition: { default: SPRING, opacity: FADE, zIndex: INSTANT },
  },
  exit: ({ turn, lead, distance }: SwipeMotion) => {
    if (turn === 'next')
      return {
        x: lead * distance,
        opacity: 0,
        zIndex: 2,
        transition: {
          default: SPRING,
          opacity: { duration: 0.2, delay: 0.12 },
          zIndex: INSTANT,
        },
      }
    if (turn === 'prev')
      return {
        ...IN_STACK,
        x: -lead * distance * 0.35,
        zIndex: 0,
        transition: { default: SPRING, opacity: FADE, zIndex: INSTANT },
      }
    return {
      y: -18,
      scale: 0.97,
      opacity: 0,
      zIndex: 0,
      transition: { default: FADE, zIndex: INSTANT },
    }
  },
}

/** A drag this far across the card, or a flick, turns it. */
const TURN_SHARE = 0.28
const FLICK_SPEED = 500
const FLICK_MIN = 24

const isTurn = (width: number, { offset, velocity }: PanInfo) =>
  Math.abs(offset.x) > width * TURN_SHARE ||
  (Math.abs(velocity.x) > FLICK_SPEED &&
    Math.abs(offset.x) > FLICK_MIN &&
    Math.sign(velocity.x) === Math.sign(offset.x))

/** The top card of the stack: dragged sideways it turns to the next or previous one. */
export function SwipeCard({ swipe, canTurn, onTurn, children }: Props) {
  const present = useIsPresent()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-320, 0, 320], [-7, 0, 7])
  const cardRef = useRef<HTMLDivElement>(null)
  // A drag that ends over a button or a word of the email must not also tap it.
  const dragged = useRef(false)

  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    const width = cardRef.current?.offsetWidth ?? 0
    if (!canTurn || !isTurn(width, info)) return
    onTurn(Math.sign(info.offset.x) === swipe.lead ? 'next' : 'prev')
  }

  return (
    <motion.div
      ref={cardRef}
      custom={swipe}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      style={{ x, rotate }}
      drag={present ? 'x' : false}
      dragDirectionLock
      dragSnapToOrigin
      dragConstraints={canTurn ? undefined : { left: 0, right: 0 }}
      dragElastic={0.18}
      whileDrag={{ scale: 1.015 }}
      onDragStart={() => {
        dragged.current = true
      }}
      onDragEnd={onDragEnd}
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
      data-vaul-no-drag
      className="relative [grid-area:1/1] rounded-[18px] border-[1.5px] border-fp-border bg-fp-surface p-4 shadow-[0_10px_24px_-14px_rgba(20,18,12,0.28)]"
    >
      {children}
    </motion.div>
  )
}
