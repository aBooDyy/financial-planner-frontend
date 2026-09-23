import { createContext, useContext } from 'react'
import type { ComponentType } from 'react'
import type {
  PayloadPick,
  PickField,
} from '#/features/inbound-imports/data/pickValues'

export type PayloadViewProps = {
  payload: Record<string, unknown>
  /** The form field a tap fills, or null when the view is read-only. */
  target: PickField | null
  onPick?: (pick: PayloadPick) => void
}

/**
 * How a JSON body is drawn. The queue owns no payload renderer of its own: the app mounts
 * one here (the integrations payload tree), so the queue never imports a source. Without
 * one, a JSON body falls back to pretty-printed text.
 */
export const PayloadViewContext =
  createContext<ComponentType<PayloadViewProps> | null>(null)

export const usePayloadView = (): ComponentType<PayloadViewProps> | null =>
  useContext(PayloadViewContext)
