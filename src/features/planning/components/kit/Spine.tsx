/** The 4px colour bar at a row's start, in the item's own colour. */
export function Spine({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="w-1 flex-none self-stretch rounded-[3px]"
      style={{ background: color }}
    />
  )
}

/** A small round swatch in an item's or wallet's colour. */
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex-none rounded-full"
      style={{ background: color, width: size, height: size }}
    />
  )
}
