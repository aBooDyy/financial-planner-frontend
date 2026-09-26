import { useId } from 'react'
import { Switch } from '#/components/ui/switch'

type Props = {
  title: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

/** An on/off setting with its consequence spelled out ("Auto-post on due date"). */
export function ToggleCard({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: Props) {
  const id = useId()
  return (
    <div className="flex items-start gap-3 rounded-[14px] border-[1.5px] border-fp-border px-[14px] py-3">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <div className="text-[14px] font-bold text-fp-text">{title}</div>
        {description ? (
          <div className="mt-[2px] text-[12px] leading-[1.45] text-fp-text-3">
            {description}
          </div>
        ) : null}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}
