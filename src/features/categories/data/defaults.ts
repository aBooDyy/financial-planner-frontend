import type { IconId } from '#/lib/icons/catalog.gen'
import type { TxType } from '#/features/transactions/api/types'

/**
 * The built-in two-level catalog: what a brand-new user's rows are seeded from on the server,
 * and what an unknown slug falls back to here. `id` is the stable slug transactions persist —
 * `t_transactions.category` holds a parent's, `.subcategory` a child's — so these must match
 * the backend's `app/config/categories.py` exactly. `savings` is the home for goal
 * contributions.
 */
export type DefaultSubcategory = { id: string; name: string; icon: IconId }

export type DefaultCategory = {
  id: string
  name: string
  type: TxType
  color: string
  icon: IconId
  subs: DefaultSubcategory[]
}

const sub = (id: string, name: string, icon: IconId): DefaultSubcategory => ({
  id,
  name,
  icon,
})

export const CATEGORIES: DefaultCategory[] = [
  // --- Spending ----------------------------------------------------------------------
  {
    id: 'groceries',
    name: 'Groceries',
    type: 'spend',
    color: '#1F9D6B',
    icon: 'shopping-cart',
    subs: [
      sub('supermarket', 'Supermarket', 'storefront'),
      sub('bakery', 'Bakery', 'bread'),
      sub('convenience', 'Convenience', 'basket'),
    ],
  },
  {
    id: 'dining',
    name: 'Dining',
    type: 'spend',
    color: '#F59E0B',
    icon: 'fork-knife',
    subs: [
      sub('restaurants', 'Restaurants', 'bowl-food'),
      sub('cafes', 'Cafés', 'coffee'),
      sub('takeaway', 'Takeaway', 'hamburger'),
    ],
  },
  {
    id: 'transport',
    name: 'Transport',
    type: 'spend',
    color: '#3B82F6',
    icon: 'car',
    subs: [
      sub('fuel', 'Fuel', 'gas-pump'),
      sub('ride_hailing', 'Ride-hailing', 'taxi'),
      sub('public_transit', 'Public transit', 'bus'),
      sub('parking', 'Parking', 'garage'),
    ],
  },
  {
    id: 'housing',
    name: 'Housing',
    type: 'spend',
    color: '#8B5CF6',
    icon: 'house',
    subs: [
      sub('rent', 'Rent', 'house-line'),
      sub('mortgage', 'Mortgage', 'bank'),
      sub('maintenance', 'Maintenance', 'wrench'),
    ],
  },
  {
    id: 'utilities',
    name: 'Utilities',
    type: 'spend',
    color: '#14B8A6',
    icon: 'lightbulb',
    subs: [
      sub('electricity', 'Electricity', 'lightning'),
      sub('water', 'Water', 'drop'),
      sub('internet', 'Internet', 'wifi-high'),
      sub('mobile', 'Mobile', 'phone'),
    ],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    type: 'spend',
    color: '#EC4899',
    icon: 'shopping-bag',
    subs: [
      sub('clothing', 'Clothing', 't-shirt'),
      sub('electronics', 'Electronics', 'laptop'),
      sub('home_goods', 'Home goods', 'couch'),
    ],
  },
  {
    id: 'health',
    name: 'Health',
    type: 'spend',
    color: '#EF4444',
    icon: 'heartbeat',
    subs: [
      sub('pharmacy', 'Pharmacy', 'pill'),
      sub('doctor', 'Doctor', 'stethoscope'),
      sub('fitness', 'Fitness', 'barbell'),
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    type: 'spend',
    color: '#6366F1',
    icon: 'mask-happy',
    subs: [
      sub('streaming', 'Streaming', 'television-simple'),
      sub('games', 'Games', 'game-controller'),
      sub('events', 'Events', 'ticket'),
    ],
  },
  {
    id: 'education',
    name: 'Education',
    type: 'spend',
    color: '#0EA5E9',
    icon: 'graduation-cap',
    subs: [
      sub('tuition', 'Tuition', 'student'),
      sub('books', 'Books', 'books'),
      sub('courses', 'Courses', 'certificate'),
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    type: 'spend',
    color: '#F97316',
    icon: 'suitcase-rolling',
    subs: [
      sub('flights', 'Flights', 'airplane-takeoff'),
      sub('hotels', 'Hotels', 'bed'),
      sub('activities', 'Activities', 'compass'),
    ],
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    type: 'spend',
    color: '#A855F7',
    icon: 'repeat',
    subs: [
      sub('apps', 'Apps', 'squares-four'),
      sub('memberships', 'Memberships', 'seal-check'),
    ],
  },
  {
    id: 'savings',
    name: 'Savings',
    type: 'spend',
    color: '#1F9D6B',
    icon: 'piggy-bank',
    subs: [
      sub('goal', 'Goal contribution', 'target'),
      sub('emergency', 'Emergency fund', 'shield-check'),
    ],
  },
  {
    id: 'other',
    name: 'Other',
    type: 'spend',
    color: '#64748B',
    icon: 'dots-three-circle',
    subs: [],
  },

  // --- Income ------------------------------------------------------------------------
  {
    id: 'salary',
    name: 'Salary',
    type: 'income',
    color: '#1F9D6B',
    icon: 'money',
    subs: [
      sub('base_pay', 'Base pay', 'money-wavy'),
      sub('bonus', 'Bonus', 'confetti'),
    ],
  },
  {
    id: 'freelance',
    name: 'Freelance',
    type: 'income',
    color: '#3B82F6',
    icon: 'briefcase',
    subs: [
      sub('projects', 'Projects', 'folder'),
      sub('consulting', 'Consulting', 'handshake'),
    ],
  },
  {
    id: 'refund',
    name: 'Refund',
    type: 'income',
    color: '#14B8A6',
    icon: 'arrows-clockwise',
    subs: [],
  },
  {
    id: 'gift',
    name: 'Gift',
    type: 'income',
    color: '#EC4899',
    icon: 'gift',
    subs: [],
  },
  {
    id: 'investment',
    name: 'Investment',
    type: 'income',
    color: '#F59E0B',
    icon: 'chart-line-up',
    subs: [
      sub('dividends', 'Dividends', 'coins'),
      sub('interest', 'Interest', 'percent'),
    ],
  },
]

const BY_ID = new Map<string, DefaultCategory>(CATEGORIES.map((c) => [c.id, c]))

// A safe fallback so a row never crashes on an unknown/legacy slug.
export const FALLBACK_CATEGORY: DefaultCategory =
  BY_ID.get('other') ?? CATEGORIES[0]

export const defaultCategory = (id: string): DefaultCategory | undefined =>
  BY_ID.get(id)

export const defaultSubcategory = (
  categoryId: string,
  subId: string,
): DefaultSubcategory | undefined =>
  BY_ID.get(categoryId)?.subs.find((s) => s.id === subId)

export const categoriesByType = (type: TxType): DefaultCategory[] =>
  CATEGORIES.filter((c) => c.type === type)

export const categoryOf = (id: string): DefaultCategory =>
  BY_ID.get(id) ?? FALLBACK_CATEGORY

export const subcategoriesOf = (categoryId: string): DefaultSubcategory[] =>
  BY_ID.get(categoryId)?.subs ?? []

export const subcategoryName = (
  categoryId: string,
  subId: string | null,
): string | null => {
  if (!subId) return null
  const found = subcategoriesOf(categoryId).find((s) => s.id === subId)
  return found ? found.name : null
}

// The category goal contributions default to.
export const SAVINGS_CATEGORY_ID = 'savings'
