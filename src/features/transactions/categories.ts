import {
  BookOpen,
  Briefcase,
  Car,
  Gamepad2,
  Gift,
  HeartPulse,
  Home,
  PiggyBank,
  Plane,
  Repeat,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Tag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TxType } from './api/types'

/**
 * The built-in, two-level category catalog. Kept deliberately small so the user isn't
 * overwhelmed; transactions persist the parent `category` slug and an optional `subcategory`
 * slug. The catalog is shared client code (not a table), so DB rows reconstruct the same view
 * on any device. `savings` is the home for goal contributions.
 */
export type Subcategory = { id: string; name: string }

export type Category = {
  id: string
  name: string
  type: TxType
  color: string
  icon: LucideIcon
  subs: Subcategory[]
}

const sub = (id: string, name: string): Subcategory => ({ id, name })

export const CATEGORIES: Category[] = [
  // --- Spending ----------------------------------------------------------------------
  {
    id: 'groceries',
    name: 'Groceries',
    type: 'spend',
    color: '#1F9D6B',
    icon: ShoppingCart,
    subs: [
      sub('supermarket', 'Supermarket'),
      sub('bakery', 'Bakery'),
      sub('convenience', 'Convenience'),
    ],
  },
  {
    id: 'dining',
    name: 'Dining',
    type: 'spend',
    color: '#F59E0B',
    icon: UtensilsCrossed,
    subs: [
      sub('restaurants', 'Restaurants'),
      sub('cafes', 'Cafés'),
      sub('takeaway', 'Takeaway'),
    ],
  },
  {
    id: 'transport',
    name: 'Transport',
    type: 'spend',
    color: '#3B82F6',
    icon: Car,
    subs: [
      sub('fuel', 'Fuel'),
      sub('ride_hailing', 'Ride-hailing'),
      sub('public_transit', 'Public transit'),
      sub('parking', 'Parking'),
    ],
  },
  {
    id: 'housing',
    name: 'Housing',
    type: 'spend',
    color: '#8B5CF6',
    icon: Home,
    subs: [
      sub('rent', 'Rent'),
      sub('mortgage', 'Mortgage'),
      sub('maintenance', 'Maintenance'),
    ],
  },
  {
    id: 'utilities',
    name: 'Utilities',
    type: 'spend',
    color: '#14B8A6',
    icon: Zap,
    subs: [
      sub('electricity', 'Electricity'),
      sub('water', 'Water'),
      sub('internet', 'Internet'),
      sub('mobile', 'Mobile'),
    ],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    type: 'spend',
    color: '#EC4899',
    icon: ShoppingBag,
    subs: [
      sub('clothing', 'Clothing'),
      sub('electronics', 'Electronics'),
      sub('home_goods', 'Home goods'),
    ],
  },
  {
    id: 'health',
    name: 'Health',
    type: 'spend',
    color: '#EF4444',
    icon: HeartPulse,
    subs: [
      sub('pharmacy', 'Pharmacy'),
      sub('doctor', 'Doctor'),
      sub('fitness', 'Fitness'),
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    type: 'spend',
    color: '#6366F1',
    icon: Gamepad2,
    subs: [
      sub('streaming', 'Streaming'),
      sub('games', 'Games'),
      sub('events', 'Events'),
    ],
  },
  {
    id: 'education',
    name: 'Education',
    type: 'spend',
    color: '#0EA5E9',
    icon: BookOpen,
    subs: [
      sub('tuition', 'Tuition'),
      sub('books', 'Books'),
      sub('courses', 'Courses'),
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    type: 'spend',
    color: '#F97316',
    icon: Plane,
    subs: [
      sub('flights', 'Flights'),
      sub('hotels', 'Hotels'),
      sub('activities', 'Activities'),
    ],
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    type: 'spend',
    color: '#A855F7',
    icon: Repeat,
    subs: [sub('apps', 'Apps'), sub('memberships', 'Memberships')],
  },
  {
    id: 'savings',
    name: 'Savings',
    type: 'spend',
    color: '#1F9D6B',
    icon: PiggyBank,
    subs: [
      sub('goal', 'Goal contribution'),
      sub('emergency', 'Emergency fund'),
    ],
  },
  {
    id: 'other',
    name: 'Other',
    type: 'spend',
    color: '#64748B',
    icon: Tag,
    subs: [],
  },

  // --- Income ------------------------------------------------------------------------
  {
    id: 'salary',
    name: 'Salary',
    type: 'income',
    color: '#1F9D6B',
    icon: Wallet,
    subs: [sub('base_pay', 'Base pay'), sub('bonus', 'Bonus')],
  },
  {
    id: 'freelance',
    name: 'Freelance',
    type: 'income',
    color: '#3B82F6',
    icon: Briefcase,
    subs: [sub('projects', 'Projects'), sub('consulting', 'Consulting')],
  },
  {
    id: 'refund',
    name: 'Refund',
    type: 'income',
    color: '#14B8A6',
    icon: RotateCcw,
    subs: [],
  },
  {
    id: 'gift',
    name: 'Gift',
    type: 'income',
    color: '#EC4899',
    icon: Gift,
    subs: [],
  },
  {
    id: 'investment',
    name: 'Investment',
    type: 'income',
    color: '#F59E0B',
    icon: TrendingUp,
    subs: [sub('dividends', 'Dividends'), sub('interest', 'Interest')],
  },
]

const BY_ID = new Map<string, Category>(CATEGORIES.map((c) => [c.id, c]))

// A safe fallback so a row never crashes on an unknown/legacy slug.
export const FALLBACK_CATEGORY: Category = BY_ID.get('other') ?? CATEGORIES[0]

export const categoriesByType = (type: TxType): Category[] =>
  CATEGORIES.filter((c) => c.type === type)

export const categoryOf = (id: string): Category =>
  BY_ID.get(id) ?? FALLBACK_CATEGORY

export const subcategoriesOf = (categoryId: string): Subcategory[] =>
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
