import { db } from '#/db/db'
import type { LocalTransaction } from '#/db/types'
import { buildCatalog } from '#/features/categories/data/catalog'
import { isAdjustment } from '#/features/transactions/api/types'
import { toMajor } from '#/lib/currency'

/**
 * Export the user's data straight from the local-first DB — no server round-trip needed. CSV
 * gives a flat transaction ledger with category names (the most useful for spreadsheets); JSON
 * is a full backup of every local table, rows referencing categories by id alongside the
 * categories themselves.
 */

const live = <T extends { deleted?: number }>(rows: T[]): T[] =>
  rows.filter((r) => r.deleted === undefined || r.deleted === 0)

/** Hand the browser a file. Shared with the importer's *Download skipped rows*. */
export function download(
  filename: string,
  mime: string,
  content: string,
): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const csvCell = (value: unknown): string => {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * An adjustment's sign is its whole meaning, and the amount column is otherwise unsigned,
 * so it is the one row exported as a signed figure under a plain name.
 */
const typeCell = (t: LocalTransaction): string =>
  isAdjustment(t.type) ? 'balance adjustment' : t.type

const amountCell = (t: LocalTransaction): number =>
  (t.type === 'adjustment_out' ? -1 : 1) * toMajor(t.amount, t.currency)

export async function exportCsv(): Promise<void> {
  const [transactions, nodes, categories] = await Promise.all([
    db.transactions.toArray(),
    db.balanceNodes.toArray(),
    db.categories.toArray(),
  ])
  const walletName = new Map(nodes.map((n) => [n.id, n.name]))
  // Rows name a leaf id; a spreadsheet wants the names, root and child in their own columns.
  const catalog = buildCatalog(categories)
  const categoryCells = (id: string | null): [string, string] => {
    if (id === null) return ['', '']
    const parent = catalog.parentOf(id)
    const name = catalog.get(id).name
    return parent ? [parent.name, name] : [name, '']
  }

  const header = [
    'date',
    'type',
    'amount',
    'currency',
    'category',
    'subcategory',
    'wallet',
    'note',
  ]
  const lines = [header.join(',')]
  for (const t of live(transactions)) {
    lines.push(
      [
        t.date,
        typeCell(t),
        amountCell(t),
        t.currency,
        ...categoryCells(t.categoryId),
        walletName.get(t.walletId) ?? t.walletId,
        t.note ?? '',
      ]
        .map(csvCell)
        .join(','),
    )
  }
  download('means-transactions.csv', 'text/csv;charset=utf-8', lines.join('\n'))
}

export async function exportJson(): Promise<void> {
  const [
    balanceNodes,
    exchangeRates,
    categories,
    transactions,
    budgets,
    recurrings,
    goals,
    incomeStreams,
  ] = await Promise.all([
    db.balanceNodes.toArray(),
    db.exchangeRates.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.recurrings.toArray(),
    db.goals.toArray(),
    db.incomeStreams.toArray(),
  ])
  const payload = {
    exportedAt: new Date().toISOString(),
    balanceNodes: live(balanceNodes),
    exchangeRates,
    categories: live(categories),
    transactions: live(transactions),
    budgets: live(budgets),
    recurrings: live(recurrings),
    goals: live(goals),
    incomeStreams: live(incomeStreams),
  }
  download(
    'means-backup.json',
    'application/json',
    JSON.stringify(payload, null, 2),
  )
}
