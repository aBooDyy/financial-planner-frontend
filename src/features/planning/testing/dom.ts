/**
 * Setup for the Planning screens' component tests: a desktop viewport, the browser APIs jsdom
 * lacks, and a local DB holding the default categories, a wallet and a monthly paycheck.
 * Test-only: nothing in the app imports this.
 */
import { db } from '#/db/db'
import { defaultCategoryRows } from '#/features/categories/__fixtures__/categories'
import { income, m, wallet } from '#/features/planned/testing/fixtures'
import { useSessionStore } from '#/stores/session'

/** A desktop `matchMedia`, so dialogs render as centred Radix dialogs. */
export function stubBrowser(): void {
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
  Element.prototype.scrollIntoView = () => undefined
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => undefined
  if (!('ResizeObserver' in globalThis))
    Object.assign(globalThis, {
      ResizeObserver: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    })
}

/** A signed-in user, an empty DB with the default categories, a wallet and a 25th paycheck. */
export async function seedPlanningDb(): Promise<void> {
  useSessionStore.setState({
    status: 'authenticated',
    user: {
      id: 'u1',
      email: 'a@b.c',
      name: 'Test',
    },
  } as never)
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.categories.bulkPut(defaultCategoryRows())
  await db.balanceNodes.put(
    wallet({ id: 'main', name: 'Main bank', amount: m(20000) }),
  )
  await db.incomeStreams.put(
    income({ id: 'salary', amount: m(12000), day: 25, walletId: 'main' }),
  )
}
