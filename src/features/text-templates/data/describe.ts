import type {
  ExtractionTemplate,
  TemplateLabel,
} from '#/features/text-templates/api/types'
import { describeLabel } from './labels'

const sameLabel = (a: TemplateLabel | null, b: TemplateLabel | null) =>
  a?.text === b?.text && a?.offset === b?.offset

/**
 * What the template reads and where, in words:
 * "Reads amount below “amount”, currency, merchant after “at”". The currency is only placed
 * when it is found somewhere other than the amount.
 */
export function describeTemplate(template: ExtractionTemplate | null): string {
  if (!template) return 'Nothing to read yet'
  const { amount, currency, merchant } = template
  const parts = [`amount ${describeLabel(amount.label)}`]
  parts.push(
    currency.mode === 'fixed'
      ? `always ${currency.code}`
      : sameLabel(currency.label, amount.label)
        ? 'currency'
        : `currency ${describeLabel(currency.label)}`,
  )
  if (merchant) parts.push(`merchant ${describeLabel(merchant.label)}`)
  return `Reads ${parts.join(', ')}`
}
