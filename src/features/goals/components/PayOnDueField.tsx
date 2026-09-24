import { Switch } from '#/components/ui/switch'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
}

/** One-time goals: also plan the final payment of the target on its due date. */
export function PayOnDueField({ checked, onChange }: Props) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[11px] border border-fp-border-strong bg-fp-surface-2 px-3 py-[10px]">
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">
          Pay on the due date
        </span>
        <span className="block text-[11.5px] leading-snug text-fp-text-3">
          Also plans the payment itself, so it shows up to confirm when it's
          due.
        </span>
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label="Pay on the due date"
      />
    </label>
  )
}
