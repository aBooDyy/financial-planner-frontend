/** The colours a bill, goal or income stream can wear (the design's item palette). */
export const ITEM_COLORS = [
  '#8B5CF6',
  '#14B8A6',
  '#06B6D4',
  '#6366F1',
  '#D6457A',
  '#F59E0B',
  '#0EA5E9',
  '#64748B',
] as const

/** The first colour no item uses yet, else one by count, so new items start apart. */
export function nextColor(used: ReadonlyArray<string>): string {
  const taken = new Set(used.map((c) => c.toLowerCase()))
  return (
    ITEM_COLORS.find((c) => !taken.has(c.toLowerCase())) ??
    ITEM_COLORS[used.length % ITEM_COLORS.length]
  )
}
