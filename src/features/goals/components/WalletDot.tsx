/** The small colour square before a wallet's name in a picker. */
export function WalletDot({ color }: { color?: string }) {
  return (
    <span
      aria-hidden
      className="size-[10px] flex-none rounded-[3px]"
      style={{ background: color ?? 'var(--fp-border-strong)' }}
    />
  )
}
