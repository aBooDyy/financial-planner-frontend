import { Separator } from '#/components/ui/separator'

type Props = { label: string }

export function Divider({ label }: Props) {
  return (
    <div className="my-5 flex items-center gap-3">
      <Separator className="flex-1 bg-fp-border" />
      <span className="text-[12.5px] font-medium whitespace-nowrap text-fp-text-3">
        {label}
      </span>
      <Separator className="flex-1 bg-fp-border" />
    </div>
  )
}
