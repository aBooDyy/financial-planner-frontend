/**
 * The first of `preferred` that is still a live wallet, else the first live wallet, else ''.
 * Order the candidates most specific first: the session's last pick, then the Settings default.
 */
export function entryWalletId(
  live: ReadonlyArray<{ id: string }>,
  preferred: ReadonlyArray<string | null>,
): string {
  const ids = new Set(live.map((w) => w.id))
  return (
    preferred.find((id) => id !== null && ids.has(id)) ?? live.at(0)?.id ?? ''
  )
}

/** A transfer's destination: the remembered one when it is live and not the source. */
export function entryToWalletId(
  live: ReadonlyArray<{ id: string }>,
  fromId: string,
  remembered: string | null,
): string {
  const others = live.filter((w) => w.id !== fromId)
  return entryWalletId(others, [remembered]) || fromId
}
