import { db } from '#/db/db'
import { buildCatalog } from '#/features/categories/data/catalog'
import { toMajor } from '#/lib/currency'

/**
 * Export the user's data straight from the local-first DB — no server round-trip needed. CSV
 * gives a flat transaction ledger (the most useful for spreadsheets); JSON is a full backup of
 * every local table.
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

export async function exportCsv(): Promise<void> {
  const [transactions, nodes, categories] = await Promise.all([
    db.transactions.toArray(),
    db.balanceNodes.toArray(),
    db.categories.toArray(),
  ])
  const walletName = new Map(nodes.map((n) => [n.id, n.name]))
  // Resolved through the catalog, so a child is named under its own parent and a slug the
  // user has since deleted still exports as the label its rows were filed under.
  const catalog = buildCatalog(categories)

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
        t.type,
        toMajor(t.amount, t.currency),
        t.currency,
        t.category === null ? '' : catalog.get(t.category).name,
        t.category === null
          ? ''
          : (catalog.sub(t.category, t.subcategory)?.name ??
            t.subcategory ??
            ''),
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
