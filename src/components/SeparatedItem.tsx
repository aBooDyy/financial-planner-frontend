import type { ReactNode } from 'react'

type Props = {
  /** Drawn in the gap before the item; hidden when the item starts a line. */
  separator?: ReactNode
  children: ReactNode
}

/** One item of a `SeparatedWrap`; shrinks to the line's width before it truncates. */
export function SeparatedItem({ separator, children }: Props) {
  return (
    <span className="relative flex min-w-0 max-w-full items-center">
      {separator ? (
        <span
          aria-hidden
          className="absolute inset-y-0 end-full flex w-(--sep-gap) items-center justify-center"
        >
          {separator}
        </span>
      ) : null}
      {children}
    </span>
  )
}
