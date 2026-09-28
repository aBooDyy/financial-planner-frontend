import type { ReactNode } from 'react'
import { SelectGroup, SelectLabel } from '#/components/ui/select'
import type { WalletSection } from '#/features/wallets/data/walletSections'

type Props<T> = {
  sections: ReadonlyArray<WalletSection<T>>
  /** One row, as a keyed `SelectItem`. */
  renderItem: (item: T) => ReactNode
}

/** A Select's wallet rows under their group names; groups are headings, never picks. */
export function WalletSelectSections<T>({ sections, renderItem }: Props<T>) {
  return sections.map((section, i) =>
    section.label === null ? (
      section.items.map(renderItem)
    ) : (
      <SelectGroup key={`${section.label}-${i}`}>
        <SelectLabel>{section.label}</SelectLabel>
        {section.items.map(renderItem)}
      </SelectGroup>
    ),
  )
}
