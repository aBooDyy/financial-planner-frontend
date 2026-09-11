import { useEffect, useState } from 'react'
import { Inbox, Plus } from 'lucide-react'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { startSync } from '#/db/sync'
import { PendingReviewModal } from '#/features/email-sync/components/PendingReviewModal'
import { usePendingImports } from '#/features/email-sync/hooks/usePendingImports'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { setBaseCurrency } from '#/features/balances/data/mutations'
import { useSessionStore } from '#/stores/session'
import { usePreferencesStore } from '#/stores/preferences'
import { currencySymbol } from '#/lib/currency'
import { runAutoPost } from '#/features/transactions/data/autopost'
import {
  addDays,
  parseISO,
  startOfToday,
  startOfWeek,
  ymd,
} from '#/features/transactions/data/planning'
import {
  buildBreakdown,
  buildBudgetsView,
  buildCalendar,
  buildCashflow,
  buildActivityList,
  buildRecurringView,
  scopeFromValue,
  scopeOptions,
  scopeToValue,
} from '#/features/transactions/data/selectors'
import type { Scope } from '#/features/transactions/data/selectors'
import type { RangeMode } from '#/features/transactions/constants'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useTransactions } from '#/features/transactions/hooks/useTransactions'
import { useTxEditor } from '#/features/transactions/hooks/useTxEditor'
import type { CurrencyCode } from '#/lib/currency'
import { BreakdownCard } from './BreakdownCard'
import { BudgetHealthCard, BudgetsCard } from './BudgetsCard'
import { CashflowHeroCard } from './CashflowHeroCard'
import { DaysCard } from './DaysCard'
import { QuickAddCard } from './QuickAddCard'
import { RecurringCard, UpcomingCard } from './RecurringCard'
import { TransactionList } from './TransactionList'
import { TxEditor } from './TxEditor'

type View = 'activity' | 'budgets' | 'recurring'

const viewSeg = (active: boolean) =>
  `rounded-[10px] px-4 py-2 text-[13.5px] ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

export function TransactionsPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const { base, data, wallets, goals, transactions } = useTransactions()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const editor = useTxEditor(wallets, base)
  const { imports: pendingImports, count: pendingCount } = usePendingImports()
  const [reviewOpen, setReviewOpen] = useState(false)

  const [view, setView] = useState<View>('activity')
  const [scope, setScope] = useState<Scope>({ type: 'all' })
  const [mode, setMode] = useState<RangeMode>('month')
  const [anchor, setAnchor] = useState(() => {
    const t = startOfToday()
    return ymd(new Date(t.getFullYear(), t.getMonth(), 1))
  })
  const [calOpen, setCalOpen] = useState(false)

  useEffect(() => startSync(), [])
  // Catch up any due auto-post recurrings once the page mounts.
  useEffect(() => {
    void runAutoPost(startOfToday())
  }, [])

  if (!user) return null

  const today = startOfToday()
  const anchorDate = parseISO(anchor)

  const stepPeriod = (dir: -1 | 1) => {
    const a = parseISO(anchor)
    if (mode === 'day') setAnchor(ymd(addDays(a, dir)))
    else if (mode === 'week') setAnchor(ymd(addDays(a, dir * 7)))
    else setAnchor(ymd(new Date(a.getFullYear(), a.getMonth() + dir, 1)))
  }
  const changeMode = (next: RangeMode) => {
    const a = parseISO(anchor)
    const sameMonth =
      a.getFullYear() === today.getFullYear() &&
      a.getMonth() === today.getMonth()
    if (next === 'month')
      setAnchor(ymd(new Date(a.getFullYear(), a.getMonth(), 1)))
    else if (next === 'week') setAnchor(ymd(startOfWeek(sameMonth ? today : a)))
    else setAnchor(ymd(sameMonth ? today : a))
    setMode(next)
  }
  const pickDay = (key: string) => {
    if (mode === 'day' && anchor === key) {
      setMode('week')
      setAnchor(ymd(startOfWeek(parseISO(key))))
    } else {
      setMode('day')
      setAnchor(key)
    }
  }

  const options = scopeOptions(data)
  const cashflow = buildCashflow(data, scope, anchorDate, mode, dateFormat)
  const calendar = buildCalendar(
    data,
    scope,
    anchorDate,
    mode,
    calOpen,
    today,
    dateFormat,
  )
  const list = buildActivityList(
    data,
    scope,
    anchorDate,
    mode,
    today,
    dateFormat,
  )
  const breakdown = buildBreakdown(data, scope, anchorDate, mode, dateFormat)
  const budgets = buildBudgetsView(data, scope, today)
  const recurring = buildRecurringView(data, scope, today)

  const onRowClick = (id: string) => {
    const t = transactions.find((x) => x.id === id)
    if (t) editor.openEditTx(t)
  }
  const onEditBudget = (id: string) => {
    const b = data.budgets.find((x) => x.id === id && x.deleted === 0)
    if (b) editor.openEditBudget(b)
  }
  const onEditRecurring = (id: string) => {
    const r = data.recurrings.find((x) => x.id === id && x.deleted === 0)
    if (r) editor.openEditRecurring(r)
  }
  const activeWallet = wallets.length > 0 ? wallets[0] : null
  const activeCurrency: CurrencyCode = activeWallet?.currency ?? base

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav
        user={user}
        active="budget"
        base={base}
        onBaseChange={(code: CurrencyCode) => void setBaseCurrency(code)}
        onSignOut={() => void logout()}
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-1 items-start gap-4 px-[14px] py-4 pb-[30px] md:max-w-[1240px] md:grid-cols-[minmax(0,1fr)_360px] md:gap-6 md:px-6 md:py-[24px] md:pb-[90px]">
          {/* Header: view tabs + global account scope */}
          <div className="md:col-span-2 flex flex-wrap items-center gap-[10px]">
            <div className="inline-flex rounded-[13px] border border-fp-border bg-fp-surface-2 p-[3px]">
              {(['activity', 'budgets', 'recurring'] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={viewSeg(view === v)}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <div className="min-w-[8px] flex-1" />
            {pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => setReviewOpen(true)}
                title="Review auto-logged transactions"
                className="inline-flex items-center gap-2 rounded-[11px] border border-fp-accent bg-fp-accent-soft px-[13px] py-[9px] text-[13px] font-bold text-fp-accent-ink"
              >
                <Inbox size={15} strokeWidth={2} />
                Review
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fp-accent px-1.5 text-[11px] font-bold text-white">
                  {pendingCount}
                </span>
              </button>
            ) : null}
            <Select
              value={scopeToValue(scope)}
              onValueChange={(v) => setScope(scopeFromValue(v))}
            >
              <SelectTrigger
                title="Filter all tabs by account"
                className="w-auto min-w-[172px] rounded-[11px] border-fp-border-strong px-[11px] py-[9px] text-[13px] font-semibold"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Left column */}
          <div className="flex min-w-0 flex-col gap-4">
            {view === 'activity' ? (
              <>
                <DaysCard
                  calendar={calendar}
                  mode={mode}
                  periodLabel={cashflow.sub}
                  calOpen={calOpen}
                  onSetMode={changeMode}
                  onPrev={() => stepPeriod(-1)}
                  onNext={() => stepPeriod(1)}
                  onToggleCal={() => setCalOpen((o) => !o)}
                  onPickDay={pickDay}
                />
                <CashflowHeroCard view={cashflow} />
                <TransactionList
                  view={list}
                  onAdd={editor.openAddTx}
                  onRowClick={onRowClick}
                />
              </>
            ) : null}
            {view === 'budgets' ? (
              <BudgetsCard
                view={budgets}
                onAdd={editor.openAddBudget}
                onEdit={onEditBudget}
              />
            ) : null}
            {view === 'recurring' ? (
              <RecurringCard
                view={recurring}
                onAdd={editor.openAddRecurring}
                onEdit={onEditRecurring}
              />
            ) : null}
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-4">
            {view === 'activity' ? (
              <>
                <div className="hidden md:block">
                  <QuickAddCard
                    walletId={activeWallet?.id ?? null}
                    currency={activeCurrency}
                    symbol={currencySymbol(activeCurrency)}
                  />
                </div>
                <BreakdownCard view={breakdown} />
              </>
            ) : null}
            {view === 'budgets' ? (
              <BudgetHealthCard view={budgets} onAdd={editor.openAddBudget} />
            ) : null}
            {view === 'recurring' ? (
              <UpcomingCard view={recurring} onAdd={editor.openAddRecurring} />
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile floating add (activity only) */}
      {view === 'activity' ? (
        <button
          type="button"
          onClick={editor.openAddTx}
          title="Add transaction"
          className="absolute bottom-[74px] right-[18px] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-fp-accent text-white shadow-[0_12px_26px_-6px_var(--fp-accent)] md:hidden"
        >
          <Plus size={26} strokeWidth={2.4} />
        </button>
      ) : null}

      <MobileTabBar active="budget" />

      {editor.editing ? (
        <TxEditor
          editing={editor.editing}
          wallets={wallets}
          goals={goals}
          onField={editor.setField}
          onType={editor.setType}
          onCategory={editor.setCategory}
          onGoal={editor.setGoal}
          onScopeType={editor.setScopeType}
          onSave={() => void editor.save()}
          onDelete={() => void editor.remove()}
          onClose={editor.close}
        />
      ) : null}

      {reviewOpen ? (
        <PendingReviewModal
          imports={pendingImports}
          wallets={wallets}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </div>
  )
}
