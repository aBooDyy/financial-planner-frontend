import { useState } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { ReviewScanPrompt } from '#/features/email-sync/components/ReviewScanPrompt'
import { PendingReviewModal } from '#/features/inbound-imports/components/PendingReviewModal'
import { usePendingImports } from '#/features/inbound-imports/hooks/usePendingImports'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { setBaseCurrency } from '#/features/wallets/data/mutations'
import { useSessionStore } from '#/stores/session'
import { usePreferencesStore } from '#/stores/preferences'
import { currencySymbol } from '#/lib/currency'
import {
  addDays,
  inWindow,
  parseISO,
  parseMonthKey,
  startOfToday,
  startOfWeek,
  windowOf,
  ymd,
} from '#/features/transactions/data/planning'
import {
  buildBreakdown,
  buildBudgetsView,
  buildCalendar,
  buildCashflow,
  buildActivityList,
  buildRecurringView,
  offeredScope,
  scopeSections,
} from '#/features/transactions/data/selectors'
import type { ActivityRow, Scope } from '#/features/transactions/data/selectors'
import {
  SPENDING_VIEWS,
  isSpendingView,
} from '#/features/transactions/constants'
import type { RangeMode } from '#/features/transactions/constants'
import { useAdjustmentEditor } from '#/features/transactions/hooks/useAdjustmentEditor'
import { useTransactions } from '#/features/transactions/hooks/useTransactions'
import { useTxEditor } from '#/features/transactions/hooks/useTxEditor'
import { usePlanned } from '#/features/planned'
import { ConfirmPlannedDialog } from '#/features/planned/components/ConfirmPlannedDialog'
import { PlannedCard } from '#/features/planned/components/PlannedCard'
import { PlannedNudge } from '#/features/planned/components/PlannedNudge'
import { PlannedSummaryCard } from '#/features/planned/components/PlannedSummaryCard'
import { useOriginColors } from '#/features/planned/hooks/useOriginColors'
import { usePlannedRowActions } from '#/features/planned/hooks/usePlannedRowActions'
import type { CurrencyCode } from '#/lib/currency'
import { AdjustmentEditor } from './AdjustmentEditor'
import { BreakdownCard } from './BreakdownCard'
import { BudgetHealthCard, BudgetsCard } from './BudgetsCard'
import { CashflowHeroCard } from './CashflowHeroCard'
import { ConnectedTxEditor } from './ConnectedTxEditor'
import { DaysCard } from './DaysCard'
import { QuickAddCard } from './QuickAddCard'
import { RecurringCard, UpcomingCard } from './RecurringCard'
import { TransactionList } from './TransactionList'
import { ScopeSelect } from './ScopeSelect'

const viewSeg = (active: boolean) =>
  `inline-flex flex-1 items-center justify-center gap-[6px] rounded-[10px] px-2 py-2 text-[13px] md:flex-none md:px-4 md:text-[13.5px] ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

export function TransactionsPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const {
    base,
    data,
    catalog,
    wallets,
    editorWallets,
    archivedWalletIds,
    goals,
    transactions,
  } = useTransactions()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const editor = useTxEditor(editorWallets, base, data.rates)
  const adjustment = useAdjustmentEditor()
  const { imports: pendingImports, count: pendingCount } = usePendingImports()
  const deepLinkedToReview =
    useSearch({ from: '/transactions' }).review === true
  const navigate = useNavigate()
  const [reviewOpen, setReviewOpen] = useState(deepLinkedToReview)

  const viewParam = useParams({ from: '/transactions/$view' }).view
  const view = isSpendingView(viewParam) ? viewParam : 'activity'
  const planned = usePlanned()
  const originColor = useOriginColors()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const plannedActions = usePlannedRowActions(setConfirmId)
  const [chosenScope, setScope] = useState<Scope>({ type: 'all' })
  const [mode, setMode] = useState<RangeMode>('month')
  const [anchor, setAnchor] = useState(() => {
    const t = startOfToday()
    return ymd(new Date(t.getFullYear(), t.getMonth(), 1))
  })
  const [calOpen, setCalOpen] = useState(false)

  if (!user) return null

  const today = startOfToday()
  const anchorDate = parseISO(anchor)

  const stepPeriod = (dir: -1 | 1) => {
    const a = parseISO(anchor)
    if (mode === 'day') setAnchor(ymd(addDays(a, dir)))
    else if (mode === 'week') setAnchor(ymd(addDays(a, dir * 7)))
    else if (mode === 'year')
      setAnchor(ymd(new Date(a.getFullYear() + dir, 0, 1)))
    else setAnchor(ymd(new Date(a.getFullYear(), a.getMonth() + dir, 1)))
  }
  const changeMode = (next: RangeMode) => {
    const a = parseISO(anchor)
    // Switching views should never jump away from now: if the period being left already
    // covers today, re-anchor on today rather than on the period's own start.
    const at = inWindow(ymd(today), windowOf(a, mode)) ? today : a
    setAnchor(ymd(windowOf(at, next).start))
    setMode(next)
  }
  const goToToday = () => setAnchor(ymd(windowOf(today, mode).start))
  const shown = windowOf(anchorDate, mode)
  const todayIs = inWindow(ymd(today), shown)
    ? null
    : today > shown.end
      ? 'ahead'
      : 'behind'
  const pickMonth = (key: string) => {
    setMode('month')
    setAnchor(ymd(parseMonthKey(key)))
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

  const sections = scopeSections(data)
  const scope = offeredScope(sections, chosenScope)
  const cashflow = buildCashflow(
    data,
    catalog,
    scope,
    anchorDate,
    mode,
    dateFormat,
  )
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
    catalog,
    scope,
    anchorDate,
    mode,
    today,
    dateFormat,
  )
  const breakdown = buildBreakdown(
    data,
    catalog,
    scope,
    anchorDate,
    mode,
    dateFormat,
  )
  const budgets = buildBudgetsView(data, catalog, scope, today)
  const recurring = buildRecurringView(data, catalog, scope, today)

  const onRowClick = (row: ActivityRow) => {
    if (row.kind === 'set_aside') {
      void navigate({ to: '/goals' })
      return
    }
    if (row.kind === 'transfer') {
      const legs = transactions.filter((x) => x.transferId === row.id)
      editor.openEditTransfer(row.id, legs)
      return
    }
    const t = transactions.find((x) => x.id === row.id)
    if (!t) return
    if (row.kind === 'adjustment') adjustment.openEdit(t)
    else editor.openEditTx(t)
  }
  const onEditBudget = (id: string) => {
    const b = data.budgets.find((x) => x.id === id && x.deleted === 0)
    if (b) editor.openEditBudget(b)
  }
  const onEditRecurring = (id: string) => {
    const r = data.recurrings.find((x) => x.id === id && x.deleted === 0)
    if (r) editor.openEditRecurring(r)
  }
  // Drop `?review=1` on close so a reload doesn't reopen what the user just dismissed.
  const closeReview = () => {
    setReviewOpen(false)
    if (deepLinkedToReview)
      void navigate({
        to: '/transactions/$view',
        params: { view },
        search: {},
        replace: true,
      })
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
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-1 items-start gap-4 px-4 py-4 pb-[30px] md:max-w-[1180px] md:grid-cols-[minmax(0,1fr)_360px] md:gap-6 md:px-6 md:py-[24px] md:pb-[90px]">
          {/* Header: view tabs + global account scope */}
          <div className="md:col-span-2 flex flex-wrap items-center gap-[10px]">
            <div className="flex w-full rounded-[13px] border border-fp-border bg-fp-surface-2 p-[3px] md:inline-flex md:w-auto">
              {SPENDING_VIEWS.map((v) => (
                <Link
                  key={v}
                  to="/transactions/$view"
                  params={{ view: v }}
                  aria-current={view === v ? 'page' : undefined}
                  className={viewSeg(view === v)}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                  {v === 'planned' && planned.dueCount > 0 ? (
                    <span
                      aria-label={`${planned.dueCount} need confirming`}
                      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fp-warn px-[5px] text-[10.5px] font-bold text-white"
                    >
                      {planned.dueCount}
                    </span>
                  ) : null}
                </Link>
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
            <ScopeSelect
              sections={sections}
              value={scope}
              onChange={setScope}
            />
          </div>

          {/* Left column */}
          <div className="flex min-w-0 flex-col gap-4">
            {view === 'activity' ? (
              <>
                {planned.dueCount > 0 ? (
                  <PlannedNudge
                    count={planned.dueCount}
                    onReview={() =>
                      void navigate({
                        to: '/transactions/$view',
                        params: { view: 'planned' },
                      })
                    }
                  />
                ) : null}
                <DaysCard
                  calendar={calendar}
                  mode={mode}
                  periodLabel={cashflow.sub}
                  calOpen={calOpen}
                  onSetMode={changeMode}
                  onPrev={() => stepPeriod(-1)}
                  onNext={() => stepPeriod(1)}
                  todayIs={todayIs}
                  onToday={goToToday}
                  onToggleCal={() => setCalOpen((o) => !o)}
                  onPickMonth={pickMonth}
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
            {view === 'planned' ? (
              <PlannedCard
                view={planned}
                loading={planned.loading}
                colorOf={originColor}
                busyId={plannedActions.busyId}
                onOpen={setConfirmId}
                onConfirm={(row) => void plannedActions.confirm(row)}
                onSkip={(row) => void plannedActions.skip(row)}
              />
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
                    wallets={wallets}
                    base={base}
                    rates={data.rates}
                  />
                </div>
                <BreakdownCard view={breakdown} />
              </>
            ) : null}
            {view === 'planned' && !planned.isEmpty ? (
              <PlannedSummaryCard view={planned} base={base} />
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

      <MobileTabBar active="budget" />

      <ConnectedTxEditor
        editor={editor}
        wallets={editorWallets}
        archivedWalletIds={archivedWalletIds}
        goals={goals}
        base={base}
        data={data}
      />

      <AdjustmentEditor
        editor={adjustment}
        wallets={editorWallets}
        dateFormat={dateFormat}
      />

      {confirmId ? (
        <ConfirmPlannedDialog
          plannedId={confirmId}
          onOpenChange={(open) => {
            if (!open) setConfirmId(null)
          }}
        />
      ) : null}

      {reviewOpen ? (
        <PendingReviewModal
          imports={pendingImports}
          wallets={wallets}
          onClose={closeReview}
          toolbar={<ReviewScanPrompt />}
        />
      ) : null}
    </div>
  )
}
