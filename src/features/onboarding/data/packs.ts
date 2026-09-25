import type { IconId } from '#/lib/icons/catalog.gen'

export type IntentId =
  | 'track'
  | 'save'
  | 'household'
  | 'freelance'
  | 'student'
  | 'travel'

export type PackId =
  | 'essentials'
  | 'saver'
  | 'family'
  | 'freelancer'
  | 'student'
  | 'traveler'

export type Intent = {
  id: IntentId
  title: string
  sub: string
  icon: IconId
  pack: PackId
}

export type Pack = {
  id: PackId
  name: string
  desc: string
  /** Default top-level category slugs, besides the required ones every pack carries. */
  slugs: readonly string[]
}

/** Kept whatever the user picks — the backend's `REQUIRED_CATEGORIES`. */
export const REQUIRED_SLUGS: readonly string[] = ['savings', 'other']

export const INTENTS: readonly Intent[] = [
  {
    id: 'track',
    title: 'Know where my money goes',
    sub: 'Track spending and stay within a budget',
    icon: 'shopping-cart',
    pack: 'essentials',
  },
  {
    id: 'save',
    title: 'Save and grow my money',
    sub: 'A safety net, a big purchase, or investments',
    icon: 'piggy-bank',
    pack: 'saver',
  },
  {
    id: 'household',
    title: 'Run a household',
    sub: 'Home, kids, school and shared bills',
    icon: 'users-three',
    pack: 'family',
  },
  {
    id: 'freelance',
    title: 'Manage irregular income',
    sub: 'Freelance or self-employed, with uneven months',
    icon: 'briefcase',
    pack: 'freelancer',
  },
  {
    id: 'student',
    title: 'Make a student budget stretch',
    sub: 'Rent, books and a little left over',
    icon: 'graduation-cap',
    pack: 'student',
  },
  {
    id: 'travel',
    title: 'Spend across currencies',
    sub: 'Travel often, or earn and spend in more than one',
    icon: 'globe',
    pack: 'traveler',
  },
]

export const PACKS: readonly Pack[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    desc: 'The everyday basics',
    slugs: [
      'groceries',
      'dining',
      'transport',
      'housing',
      'utilities',
      'health',
      'shopping',
      'personal_care',
      'government',
      'salary',
      'refund',
    ],
  },
  {
    id: 'saver',
    name: 'Saver',
    desc: 'Steady budgets, savings and returns',
    slugs: [
      'groceries',
      'dining',
      'transport',
      'housing',
      'utilities',
      'health',
      'insurance',
      'subscriptions',
      'salary',
      'investment',
    ],
  },
  {
    id: 'family',
    name: 'Family household',
    desc: 'Home, kids and shared bills',
    slugs: [
      'groceries',
      'family',
      'housing',
      'utilities',
      'transport',
      'health',
      'insurance',
      'education',
      'shopping',
      'entertainment',
      'giving',
      'salary',
      'gift',
    ],
  },
  {
    id: 'freelancer',
    name: 'Freelancer',
    desc: 'Client income and work costs',
    slugs: [
      'groceries',
      'dining',
      'transport',
      'housing',
      'utilities',
      'subscriptions',
      'education',
      'government',
      'freelance',
      'refund',
      'other_income',
    ],
  },
  {
    id: 'student',
    name: 'Student',
    desc: 'Tight budgets, study costs',
    slugs: [
      'groceries',
      'dining',
      'transport',
      'education',
      'subscriptions',
      'entertainment',
      'personal_care',
      'salary',
      'gift',
    ],
  },
  {
    id: 'traveler',
    name: 'Traveler',
    desc: 'Trips and multi-currency spend',
    slugs: [
      'groceries',
      'dining',
      'transport',
      'housing',
      'travel',
      'shopping',
      'entertainment',
      'insurance',
      'government',
      'salary',
      'refund',
    ],
  },
]

/** When goals point at several packs, the most specific one wins. */
const PRIORITY: readonly PackId[] = [
  'family',
  'freelancer',
  'student',
  'traveler',
  'saver',
  'essentials',
]

export const packById = (id: PackId): Pack =>
  PACKS.find((p) => p.id === id) ?? PACKS[0]

export function suggestedPackId(intents: readonly IntentId[]): PackId {
  const packs = new Set(
    INTENTS.filter((i) => intents.includes(i.id)).map((i) => i.pack),
  )
  return PRIORITY.find((p) => packs.has(p)) ?? 'essentials'
}

export const packSelection = (id: PackId): string[] => [
  ...packById(id).slugs,
  ...REQUIRED_SLUGS,
]

export const isRequired = (slug: string): boolean =>
  REQUIRED_SLUGS.includes(slug)

export function isCustomized(
  selection: readonly string[],
  id: PackId,
): boolean {
  const pack = new Set(packSelection(id))
  return selection.length !== pack.size || selection.some((s) => !pack.has(s))
}

export function toggleSlug(
  selection: readonly string[],
  slug: string,
): string[] {
  if (isRequired(slug)) return [...selection]
  return selection.includes(slug)
    ? selection.filter((s) => s !== slug)
    : [...selection, slug]
}
