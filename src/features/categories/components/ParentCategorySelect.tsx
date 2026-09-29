import type { ReactNode } from 'react'
import { IconChip } from '#/components/icons/IconChip'
import { ReasonTooltip } from '#/components/ReasonTooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { ResolvedCategory } from '#/features/categories/data/catalog'

type Props = {
  id?: string
  /** The chosen parent's id; `null` for a category of its own. */
  value: string | null
  options: ReadonlyArray<ResolvedCategory>
  /** The first option, which files it at the top level. */
  noneLabel: string
  /** Why the whole select is off. */
  locked?: string | null
  /** Why one choice is off, by parent id (`null`: the top level). */
  blocked?: ReadonlyMap<string | null, string>
  onChange: (parent: ResolvedCategory | null) => void
}

const NONE = '__top__'
const NOTHING_BLOCKED: ReadonlyMap<string | null, string> = new Map()

// A disabled item takes no pointer events, which would leave its tooltip unreachable; Radix
// still refuses to select it.
const BLOCKED_ITEM =
  'data-[disabled]:pointer-events-auto data-[disabled]:cursor-not-allowed'

/** Where a category goes: at the top level, or inside one of these as a subcategory. */
export function ParentCategorySelect({
  id,
  value,
  options,
  noneLabel,
  locked = null,
  blocked = NOTHING_BLOCKED,
  onChange,
}: Props) {
  const trigger = (
    <SelectTrigger
      id={id}
      className="disabled:pointer-events-none disabled:opacity-60"
    >
      <SelectValue />
    </SelectTrigger>
  )
  return (
    <Select
      value={value ?? NONE}
      disabled={locked !== null}
      onValueChange={(next) =>
        onChange(
          next === NONE ? null : (options.find((c) => c.id === next) ?? null),
        )
      }
    >
      {locked === null ? (
        trigger
      ) : (
        // The disabled trigger gets no events, so this wrapper is what hovers and focuses.
        <ReasonTooltip reason={locked}>
          <span
            tabIndex={0}
            aria-label={locked}
            className="block cursor-not-allowed rounded-[12px] outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/30"
          >
            {trigger}
          </span>
        </ReasonTooltip>
      )}
      <SelectContent className="max-h-[320px]">
        <Choice value={NONE} textValue={noneLabel} reason={blocked.get(null)}>
          {noneLabel}
        </Choice>
        {options.map((c) => (
          <Choice
            key={c.id}
            value={c.id}
            textValue={c.name}
            reason={blocked.get(c.id)}
          >
            <IconChip
              id={c.icon}
              color={c.color}
              size={22}
              iconSize={13}
              className="rounded-[7px]"
            />
            <span className="truncate">{c.name}</span>
          </Choice>
        ))}
      </SelectContent>
    </Select>
  )
}

function Choice({
  value,
  textValue,
  reason,
  children,
}: {
  value: string
  textValue: string
  reason: string | undefined
  children: ReactNode
}) {
  return (
    <ReasonTooltip reason={reason ?? null}>
      <SelectItem
        value={value}
        textValue={textValue}
        disabled={reason !== undefined}
        className={BLOCKED_ITEM}
      >
        {children}
      </SelectItem>
    </ReasonTooltip>
  )
}
