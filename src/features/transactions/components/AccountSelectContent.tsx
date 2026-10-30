import {
  SelectContent,
  SelectItem,
  SelectSeparator,
} from '#/components/ui/select'
import type { ScopeSection } from '#/features/transactions/data/selectors'
import { AccountTreeGroups } from './AccountTreeGroups'

/** An answer that is not a wallet, listed around the tree. */
export type AccountChoice = { value: string; label: string }

/** The value of the "no account" row. */
export const NO_ACCOUNT = '__none__'

type Props = {
  sections: ReadonlyArray<ScopeSection>
  amountsLoading?: boolean
  /** Offers no wallet at all, read as this. */
  noneLabel?: string
  trailing?: ReadonlyArray<AccountChoice>
}

const ITEM = 'text-[13px]'

/** A wallet `Select`'s open list: the account tree, with any answers that aren't a wallet. */
export function AccountSelectContent({
  sections,
  amountsLoading,
  noneLabel,
  trailing = [],
}: Props) {
  const hasTree = sections.length > 0
  return (
    <SelectContent className="min-w-[260px]">
      {noneLabel ? (
        <>
          <SelectItem value={NO_ACCOUNT} className={ITEM}>
            {noneLabel}
          </SelectItem>
          {hasTree ? <SelectSeparator /> : null}
        </>
      ) : null}
      <AccountTreeGroups sections={sections} amountsLoading={amountsLoading} />
      {trailing.length > 0 && hasTree ? <SelectSeparator /> : null}
      {trailing.map((choice) => (
        <SelectItem key={choice.value} value={choice.value} className={ITEM}>
          {choice.label}
        </SelectItem>
      ))}
    </SelectContent>
  )
}
