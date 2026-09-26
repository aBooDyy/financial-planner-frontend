import { Button } from '#/components/ui/button'

type Props = {
  label: string
  disabled: boolean
  /** Where the entry will show up, under the button. */
  caption: string
}

/** A footer-less dialog's full-width submit, with its caption beneath. */
export function BodySubmit({ label, disabled, caption }: Props) {
  return (
    <div className="flex flex-col gap-[10px]">
      <Button
        type="submit"
        size="dialog"
        disabled={disabled}
        className="w-full disabled:bg-fp-surface-2 disabled:text-fp-text-3 disabled:opacity-100 disabled:shadow-none!"
      >
        {label}
      </Button>
      <p className="text-center text-[12px] leading-[1.45] text-fp-text-3">
        {caption}
      </p>
    </div>
  )
}
