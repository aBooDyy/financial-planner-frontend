import type { ReactNode } from 'react'
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '#/components/ui/dropdown-menu'
import { MENU_LABEL } from '#/components/ui/menu-surface'
import type { WalletSection } from '#/features/wallets/data/walletSections'

type Props<T> = {
  sections: ReadonlyArray<WalletSection<T>>
  /** One row, as a keyed `DropdownMenuRadioItem` or `DropdownMenuItem`. */
  renderItem: (item: T) => ReactNode
}

/** A dropdown menu's wallet rows under their group names; groups are headings, never picks. */
export function WalletMenuSections<T>({ sections, renderItem }: Props<T>) {
  return sections.map((section, i) =>
    section.label === null ? (
      section.items.map(renderItem)
    ) : (
      <DropdownMenuGroup key={`${section.label}-${i}`}>
        <DropdownMenuLabel className={MENU_LABEL}>
          {section.label}
        </DropdownMenuLabel>
        {section.items.map(renderItem)}
      </DropdownMenuGroup>
    ),
  )
}
