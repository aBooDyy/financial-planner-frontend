import { useState } from 'react'
import { Search } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { FIELD_WELL } from '#/components/ui/field-well'
import { MerchantOptions } from '#/features/merchants/components/MerchantOptions'
import { useMerchantName } from '#/features/merchants/hooks/useMerchantName'
import { cn } from '#/lib/utils'

type Props = {
  id: string
  value: string | null
  onChange: (merchantId: string | null) => void
  placeholder: string
}

/** Who is paid: the shared merchant search, as a field that opens it. */
export function MerchantField({ id, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [fallback, setFallback] = useState('')
  const name = useMerchantName(value, fallback)
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            FIELD_WELL,
            'flex w-full items-center gap-[9px] px-[14px] py-3 text-start',
          )}
        >
          <Search size={15} aria-hidden className="flex-none text-fp-text-3" />
          <span
            className={cn(
              'truncate text-[14px]',
              name ? 'font-semibold text-fp-text' : 'text-fp-text-3',
            )}
          >
            {name || placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-2">
        <MerchantOptions
          value={value}
          listClassName="max-h-[260px]"
          onPick={(merchant) => {
            setFallback(merchant?.displayName ?? '')
            onChange(merchant?.id ?? null)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
