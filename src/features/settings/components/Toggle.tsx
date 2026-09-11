import { Switch } from '#/components/ui/switch'

type Props = {
  on: boolean
  onChange: () => void
  label?: string
}

/** The pill switch used across Settings (notifications, auto-update, backup, …). */
export function Toggle({ on, onChange, label }: Props) {
  return <Switch checked={on} onCheckedChange={onChange} aria-label={label} />
}
