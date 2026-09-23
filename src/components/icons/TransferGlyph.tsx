type Props = {
  size?: number
  strokeWidth?: number
  className?: string
}

/**
 * The Means ⇄ transfer mark: two opposed half-headed arrows. Chrome, but not in Lucide.
 * Point-symmetric, so it needs no RTL mirroring.
 */
export function TransferGlyph({
  size = 16,
  strokeWidth = 1.9,
  className,
}: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 8h14l-4-4" />
      <path d="M20 16H6l4 4" />
    </svg>
  )
}
