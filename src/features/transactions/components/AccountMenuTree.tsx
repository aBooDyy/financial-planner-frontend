import { Fragment } from 'react'
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '#/components/ui/dropdown-menu'
import { walletIdOf } from '#/features/transactions/data/selectors'
import type { ScopeSection } from '#/features/transactions/data/selectors'
import { AccountOptionContent } from './AccountTreeGroups'

type Props = {
  sections: ReadonlyArray<ScopeSection>
  amountsLoading: boolean
}

const INDENT_PX = 18
const RADIO_GUTTER_PX = 32

/** `AccountTreeGroups` for a `DropdownMenuRadioGroup`, whose trigger is too custom for a `Select`. */
export function AccountMenuTree({ sections, amountsLoading }: Props) {
  return sections.map((section, i) => (
    <Fragment key={section.options[0]?.value ?? i}>
      {i > 0 ? <DropdownMenuSeparator /> : null}
      <DropdownMenuGroup>
        {section.label ? (
          <DropdownMenuLabel className="text-[11px] font-bold tracking-[0.04em] text-fp-text-3 uppercase">
            {section.label}
          </DropdownMenuLabel>
        ) : null}
        {section.options.map((option) => {
          const indent = {
            paddingInlineStart: RADIO_GUTTER_PX + option.depth * INDENT_PX,
          }
          return option.kind === 'group' ? (
            <DropdownMenuLabel
              key={option.value}
              style={indent}
              className="flex items-center gap-2 py-[7px] text-[13px] text-fp-text"
            >
              <AccountOptionContent
                option={option}
                amountsLoading={amountsLoading}
              />
            </DropdownMenuLabel>
          ) : (
            <DropdownMenuRadioItem
              key={option.value}
              value={walletIdOf(option)}
              style={indent}
              className="text-[13px]"
            >
              <AccountOptionContent
                option={option}
                amountsLoading={amountsLoading}
              />
            </DropdownMenuRadioItem>
          )
        })}
      </DropdownMenuGroup>
    </Fragment>
  ))
}
