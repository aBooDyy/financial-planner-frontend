import { useIsDesktop } from '#/hooks/useMediaQuery'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { PACKS, packSelection } from '../data/packs'
import type { Pack, PackId } from '../data/packs'
import { PackCard } from './PackCard'

type Props = {
  catalog: CategoryCatalog
  activeId: PackId
  suggestedId: PackId
  customized: boolean
  onPick: (id: PackId) => void
  onReset: () => void
}

const DOT_COUNT = 5

/** Mobile scrolls the packs sideways, so the suggestion leads the row there. */
const ordered = (suggestedId: PackId, suggestedFirst: boolean): Pack[] =>
  suggestedFirst
    ? [
        ...PACKS.filter((p) => p.id === suggestedId),
        ...PACKS.filter((p) => p.id !== suggestedId),
      ]
    : [...PACKS]

export function PackPicker({
  catalog,
  activeId,
  suggestedId,
  customized,
  onPick,
  onReset,
}: Props) {
  const isDesktop = useIsDesktop()
  const known = new Set(catalog.all.map((c) => c.slug))

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-bold tracking-[0.05em] text-fp-text-3 uppercase">
          Starter packs
        </h2>
        {customized && (
          <div className="flex items-center gap-2.5">
            <span className="rounded-full border border-fp-border bg-fp-surface-2 px-[9px] py-[3px] text-[12px] font-semibold text-fp-text-2">
              Customized
            </span>
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer text-[12.5px] font-semibold text-fp-accent-ink hover:underline"
            >
              Reset to pack
            </button>
          </div>
        )}
      </div>
      <div className="-me-5 mt-2.5 flex snap-x gap-[9px] overflow-x-auto pt-2.5 pe-5 pb-1 [scrollbar-width:none] md:me-0 md:grid md:grid-cols-3 md:overflow-visible md:pe-0">
        {ordered(suggestedId, !isDesktop).map((pack) => {
          const slugs = packSelection(pack.id).filter((s) => known.has(s))
          const dots = slugs
            .map((s) => catalog.get(s))
            .filter((c) => c.type === 'spend')
            .slice(0, DOT_COUNT)
            .map((c) => c.color)
          return (
            <PackCard
              key={pack.id}
              pack={pack}
              on={pack.id === activeId}
              suggested={pack.id === suggestedId}
              count={slugs.length}
              dots={dots}
              onPick={() => onPick(pack.id)}
            />
          )
        })}
      </div>
    </section>
  )
}
