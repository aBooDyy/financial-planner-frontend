/**
 * Builders for the reports slice's tests. Test-only: nothing in the app imports this.
 */
import { buildCatalog } from '#/features/categories/data/catalog'
import {
  catId,
  categoryRow,
} from '#/features/categories/__fixtures__/categories'
import type { FlowRow } from '#/features/reports/data/flowRows'

export const DINING = catId('dining')
export const CAFES = catId('cafes', 'dining')
export const TAKEAWAY = catId('takeaway', 'dining')
export const GROCERIES = catId('groceries')
export const SALARY = catId('salary')
export const FREELANCE = catId('freelance')
export const INVESTING = catId('investing')
export const OTHER = catId('other')
export const RENT = catId('rent', 'housing')
export const HOUSING = catId('housing')

export const reportCatalog = () =>
  buildCatalog([
    categoryRow({
      slug: 'dining',
      name: 'Dining',
      color: '#EF4444',
      spendClass: 'want',
      position: 0,
    }),
    categoryRow({
      id: CAFES,
      parentId: DINING,
      slug: 'cafes',
      name: 'Cafés',
      color: '',
      position: 0,
    }),
    categoryRow({
      id: TAKEAWAY,
      parentId: DINING,
      slug: 'takeaway',
      name: 'Takeaway',
      color: '',
      position: 1,
    }),
    categoryRow({
      slug: 'groceries',
      name: 'Groceries',
      color: '#22C55E',
      spendClass: 'need',
      position: 1,
    }),
    categoryRow({
      slug: 'salary',
      name: 'Salary',
      type: 'income',
      color: '#1F9D6B',
      position: 2,
    }),
    categoryRow({
      slug: 'freelance',
      name: 'Freelance',
      type: 'income',
      color: '#0EA5E9',
      position: 3,
    }),
    categoryRow({
      slug: 'investing',
      name: 'Investing',
      color: '#1F9D6B',
      spendClass: 'saving',
      position: 4,
    }),
    categoryRow({
      slug: 'other',
      name: 'Other',
      color: '#64748B',
      position: 5,
    }),
    categoryRow({
      slug: 'housing',
      name: 'Housing',
      color: '#8B5CF6',
      spendClass: 'need',
      position: 6,
    }),
    categoryRow({
      id: RENT,
      parentId: HOUSING,
      slug: 'rent',
      name: 'Rent',
      color: '',
      position: 0,
    }),
  ])

let seq = 0

export const flow = (over: Partial<FlowRow> = {}): FlowRow => ({
  id: `f${String(++seq).padStart(4, '0')}`,
  date: '2026-09-10',
  type: 'spend',
  categoryId: GROCERIES,
  amount: 10_000,
  merchantId: null,
  note: null,
  ...over,
})
