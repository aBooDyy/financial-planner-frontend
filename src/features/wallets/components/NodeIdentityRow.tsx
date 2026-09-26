import { FormRow } from '#/components/FormRow'
import { IconChip } from '#/components/icons/IconChip'
import { Input } from '#/components/ui/input'
import type { IconId } from '#/lib/icons/catalog.gen'

type Props = {
  icon: IconId
  color: string
  name: string
  namePlaceholder: string
  onName: (name: string) => void
  onChangeIcon: () => void
}

/** The editor's lead: the node's icon tile (tap to change it) beside its name. */
export function NodeIdentityRow({
  icon,
  color,
  name,
  namePlaceholder,
  onName,
  onChangeIcon,
}: Props) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-[14px]">
      <button
        type="button"
        aria-label="Change icon"
        onClick={onChangeIcon}
        className="flex flex-col items-center gap-[5px] rounded-[17px] outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/30"
      >
        <IconChip
          id={icon}
          color={color}
          size={56}
          className="rounded-[17px]"
        />
        <span className="text-[11.5px] font-bold text-fp-accent-ink">
          Change
        </span>
      </button>
      <FormRow id="node-name" label="Name">
        <Input
          id="node-name"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={namePlaceholder}
        />
      </FormRow>
    </div>
  )
}
