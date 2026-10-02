import type { SpendClass } from '#/features/categories/api/types'

/** The buckets in the order every list, bar and legend draws them. */
export const SPEND_CLASSES: ReadonlyArray<SpendClass> = [
  'need',
  'want',
  'saving',
]

export const SPEND_CLASS_LABEL: Record<SpendClass, string> = {
  need: 'Needs',
  want: 'Wants',
  saving: 'Savings',
}

export const UNSORTED_LABEL = 'Not sorted'

/**
 * Each bucket's fill. A categorical set checked for colour-blind separation on both themes'
 * surfaces, so it carries its own dark steps rather than a token.
 */
export const SPEND_CLASS_FILL: Record<SpendClass, string> = {
  need: 'bg-[#4F6BD8] dark:bg-[#7088EA]',
  want: 'bg-[#C2410C] dark:bg-[#E2703A]',
  saving: 'bg-fp-chart-in',
}

export const UNSORTED_FILL = 'bg-fp-border-strong'
