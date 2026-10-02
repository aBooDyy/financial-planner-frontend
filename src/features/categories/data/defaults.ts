import type { IconId } from '#/lib/icons/catalog.gen'
import type { TxType } from '#/features/transactions/api/types'
import type { SpendClass } from '#/features/categories/api/types'

/**
 * The built-in two-level catalog the server seeds a new user's rows from. Here it only
 * supplies the default icon for a row whose own is unset, looked up by slug — so `id` (the
 * slug) and `icon` must match the backend's `app/config/categories.py`.
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
      sub('convenience', 'Convenience store', 'basket'),
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
      sub('takeaway', 'Takeaway & delivery', 'hamburger'),
      sub('snacks', 'Snacks & desserts', 'cookie'),
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
      sub('maintenance', 'Repairs & maintenance', 'hammer'),
      sub('furniture', 'Furniture & home goods', 'couch'),
      sub('home_services', 'Home services', 'truck'),
    ],
  },
  {
    id: 'utilities',
    name: 'Bills & utilities',
    type: 'spend',
    color: '#14B8A6',
    icon: 'lightbulb',
    subs: [
      sub('electricity', 'Electricity', 'lightning'),
      sub('water', 'Water', 'drop'),
      sub('gas', 'Gas', 'fire'),
      sub('internet', 'Internet', 'wifi-high'),
      sub('phone', 'Phone', 'phone'),
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
      sub('maintenance', 'Car maintenance', 'wrench'),
      sub('car_wash', 'Car wash', 'drop'),
      sub('parking', 'Parking & tolls', 'garage'),
      sub('taxi', 'Taxi', 'taxi'),
      sub('public_transit', 'Public transit', 'bus'),
      sub('fines', 'Traffic fines', 'traffic-sign'),
    ],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    type: 'spend',
    color: '#EC4899',
    icon: 'shopping-bag',
    subs: [
      sub('clothing', 'Clothing & shoes', 't-shirt'),
      sub('electronics', 'Electronics', 'laptop'),
      sub('accessories', 'Accessories & jewellery', 'watch'),
    ],
  },
  {
    id: 'personal_care',
    name: 'Personal care',
    type: 'spend',
    color: '#D946EF',
    icon: 'scissors',
    subs: [
      sub('hair', 'Hair & barber', 'scissors'),
      sub('beauty', 'Beauty & fragrance', 'sparkle'),
      sub('toiletries', 'Toiletries', 'shower'),
      sub('laundry', 'Laundry & dry cleaning', 'washing-machine'),
    ],
  },
  {
    id: 'health',
    name: 'Health',
    type: 'spend',
    color: '#EF4444',
    icon: 'heartbeat',
    subs: [
      sub('doctor', 'Doctor', 'stethoscope'),
      sub('pharmacy', 'Pharmacy', 'pill'),
      sub('dental', 'Dental', 'tooth'),
      sub('eye_care', 'Eye care', 'eyeglasses'),
      sub('fitness', 'Fitness', 'barbell'),
    ],
  },
  {
    id: 'family',
    name: 'Family & kids',
    type: 'spend',
    color: '#F43F5E',
    icon: 'users-three',
    subs: [
      sub('childcare', 'Childcare', 'baby'),
      sub('kids_activities', "Kids' activities", 'puzzle-piece'),
      sub('kids_supplies', 'Baby & kids supplies', 'baby-carriage'),
      sub('pocket_money', 'Pocket money', 'hand-coins'),
      sub('support', 'Family support', 'hand-heart'),
    ],
  },
  {
    id: 'pets',
    name: 'Pets',
    type: 'spend',
    color: '#65A30D',
    icon: 'paw-print',
    subs: [
      sub('pet_food', 'Food', 'bone'),
      sub('vet', 'Vet', 'stethoscope'),
      sub('pet_supplies', 'Grooming & supplies', 'scissors'),
    ],
  },
  {
    id: 'education',
    name: 'Education',
    type: 'spend',
    color: '#0EA5E9',
    icon: 'graduation-cap',
    subs: [
      sub('tuition', 'Tuition & school fees', 'student'),
      sub('books', 'Books & supplies', 'books'),
      sub('courses', 'Courses & exams', 'certificate'),
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    type: 'spend',
    color: '#6366F1',
    icon: 'mask-happy',
    subs: [
      sub('movies', 'Movies & shows', 'film-slate'),
      sub('events', 'Events & outings', 'ticket'),
      sub('games', 'Games', 'game-controller'),
      sub('sports', 'Sports', 'soccer-ball'),
      sub('hobbies', 'Hobbies', 'palette'),
    ],
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    type: 'spend',
    color: '#A855F7',
    icon: 'repeat',
    subs: [
      sub('streaming', 'TV & streaming', 'television-simple'),
      sub('music', 'Music', 'music-notes'),
      sub('software', 'Apps & software', 'squares-four'),
      sub('cloud', 'Cloud storage', 'cloud'),
      sub('memberships', 'Memberships', 'seal-check'),
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
      sub('travel_transport', 'Car rental & transport', 'road-horizon'),
      sub('activities', 'Activities', 'compass'),
    ],
  },
  {
    id: 'insurance',
    name: 'Insurance',
    type: 'spend',
    color: '#0284C7',
    icon: 'umbrella',
    subs: [
      sub('health_insurance', 'Health', 'first-aid-kit'),
      sub('car_insurance', 'Car', 'car-profile'),
      sub('home_insurance', 'Home', 'house'),
      sub('life_insurance', 'Life', 'heart'),
    ],
  },
  {
    id: 'debt',
    name: 'Debt & loans',
    type: 'spend',
    color: '#B45309',
    icon: 'bank',
    subs: [
      sub('loan_payments', 'Loan payments', 'calendar-check'),
      sub('interest', 'Interest & charges', 'percent'),
      sub('bnpl', 'Buy now, pay later', 'credit-card'),
    ],
  },
  {
    id: 'taxes',
    name: 'Taxes & fees',
    type: 'spend',
    color: '#78716C',
    icon: 'stamp',
    subs: [
      sub('taxes', 'Taxes', 'calculator'),
      sub('government_fees', 'Government fees', 'stamp'),
      sub('bank_fees', 'Bank fees', 'bank'),
    ],
  },
  {
    id: 'giving',
    name: 'Gifts & giving',
    type: 'spend',
    color: '#BE185D',
    icon: 'gift',
    subs: [
      sub('gifts', 'Gifts', 'gift'),
      sub('charity', 'Charity', 'hand-heart'),
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
      sub('investing', 'Investing', 'chart-line-up'),
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
    id: 'business',
    name: 'Business & freelance',
    type: 'income',
    color: '#3B82F6',
    icon: 'briefcase',
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
      sub('returns', 'Returns', 'trend-up'),
    ],
  },
  {
    id: 'gift',
    name: 'Gifts received',
    type: 'income',
    color: '#EC4899',
    icon: 'gift',
    subs: [],
  },
  {
    id: 'refund',
    name: 'Refunds',
    type: 'income',
    color: '#14B8A6',
    icon: 'arrows-clockwise',
    subs: [
      sub('reimbursement', 'Reimbursements', 'receipt'),
      sub('cashback', 'Cashback', 'percent'),
    ],
  },
  {
    id: 'other_income',
    name: 'Other income',
    type: 'income',
    color: '#64748B',
    icon: 'coins',
    subs: [],
  },
]

const BY_SLUG = new Map<string, DefaultCategory>(
  CATEGORIES.map((c) => [c.id, c]),
)

export const defaultCategory = (slug: string): DefaultCategory | undefined =>
  BY_SLUG.get(slug)

export const defaultSubcategory = (
  parentSlug: string,
  slug: string,
): DefaultSubcategory | undefined =>
  BY_SLUG.get(parentSlug)?.subs.find((s) => s.id === slug)

/**
 * The Needs / Wants / Savings tag each spending root is seeded with — must match the
 * backend's `SPEND_CLASS_DEFAULTS`. Subcategories start untagged and inherit; `other` starts
 * not sorted; income roots never carry one.
 */
export const SPEND_CLASS_DEFAULTS: Readonly<Record<string, SpendClass>> = {
  groceries: 'need',
  housing: 'need',
  utilities: 'need',
  transport: 'need',
  health: 'need',
  insurance: 'need',
  debt: 'need',
  taxes: 'need',
  education: 'need',
  family: 'need',
  dining: 'want',
  shopping: 'want',
  personal_care: 'want',
  pets: 'want',
  entertainment: 'want',
  subscriptions: 'want',
  travel: 'want',
  giving: 'want',
  savings: 'saving',
}

export const defaultSpendClass = (slug: string): SpendClass | null =>
  SPEND_CLASS_DEFAULTS[slug] ?? null
