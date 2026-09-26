import type { ComponentProps } from 'react'
import { Chip } from '#/components/dialog/Chip'

/** A one-tap pill in the transaction dialog; a chosen one wears the type's tint by default. */
export function TxChip(props: ComponentProps<typeof Chip>) {
  return <Chip color="var(--tx-ink)" {...props} />
}
