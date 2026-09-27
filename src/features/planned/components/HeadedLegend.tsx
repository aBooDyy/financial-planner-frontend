import type { HeadedLine } from '#/features/planned/data/headed'

/** The bar's parts, in its order; each swatch is the key to its segment. */
export function HeadedLegend({ lines }: { lines: HeadedLine[] }) {
  return (
    <ul className="flex flex-col gap-[6px]">
      {lines.map((line) => (
        <li key={line.key} className="flex items-center gap-2 text-[12.5px]">
          <span
            aria-hidden
            className="size-[9px] shrink-0 rounded-[3px]"
            style={{ background: line.color }}
          />
          <span className="min-w-0 flex-1 truncate text-fp-text-2">
            {line.label}
          </span>
          <span className="fp-sensitive font-bold whitespace-nowrap tabular-nums">
            {line.valueStr}
          </span>
        </li>
      ))}
    </ul>
  )
}
