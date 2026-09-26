import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
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
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import {
  offeredScope,
  scopeSections,
} from '#/features/transactions/data/selectors'
import type { Scope } from '#/features/transactions/data/selectors'
import type { LocalTransaction } from '#/db/types'
import { isSpendingView } from '#/features/transactions/constants'
import { useActivityRowClick } from '#/features/transactions/hooks/useActivityRowClick'
import { useAdjustmentEditor } from '#/features/transactions/hooks/useAdjustmentEditor'
import { useLedgerWindow } from '#/features/transactions/hooks/useLedgerWindow'
import { useSpendingPeriod } from '#/features/transactions/hooks/useSpendingPeriod'
import { useSpendingViews } from '#/features/transactions/hooks/useSpendingViews'
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
import { SpendingViewTabs } from './SpendingViewTabs'

const NO_ROWS: LocalTransaction[] = []
const NO_DELTAS: Record<string, number> = {}

export function TransactionsPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const {
    loading,
    base,
    inputs,
    deltas,
    catalog,
    wallets,
    editorWallets,
    archivedWalletIds,
    goals,
  } = useTransactions()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const editor = useTxEditor(editorWallets, base, inputs.rates)
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
  const [calOpen, setCalOpen] = useState(false)

  const today = startOfToday()
  const todayKey = ymd(today)
  const period = useSpendingPeriod(today)
  const ledger = useLedgerWindow(period.anchor, period.mode, todayKey)

  // Laid out from the accounts alone; the balances in it wait for `deltas`.
  const sections = useMemo(
    () => scopeSections(inputs, deltas ?? NO_DELTAS),
    [inputs, deltas],
  )
  const scope = loading ? chosenScope : offeredScope(sections, chosenScope)
  const views = useSpendingViews({
    view,
    anchor: period.anchor,
    mode: period.mode,
    inputs: loading ? null : inputs,
    ledger,
    catalog,
    scope,
    calOpen,
    today: todayKey,
    dateFormat,
  })
  const onRowClick = useActivityRowClick(
    editor,
    adjustment,
    ledger?.rows ?? NO_ROWS,
  )

  if (!user) return null

  const onEditBudget = (id: string) => {
    const b = inputs.budgets.find((x) => x.id === id && x.deleted === 0)
    if (b) editor.openEditBudget(b)
  }
  const onEditRecurring = (id: string) => {
    const r = inputs.recurrings.find((x) => x.id === id && x.deleted === 0)
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
  const { activity, budgets, recurring } = views
  const busy =
    view === 'activity'
      ? !activity?.cashflow
      : view === 'budgets'
        ? !budgets
        : view === 'recurring'
          ? !recurring
          : false

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
        <span role="status" className="sr-only">
          {busy ? 'Loading your spending…' : ''}
        </span>
        <div
          aria-busy={busy}
          className="mx-auto grid w-full max-w-[560px] grid-cols-1 items-start gap-4 px-4 py-4 pb-[30px] md:max-w-[1180px] md:grid-cols-[minmax(0,1fr)_360px] md:gap-6 md:px-6 md:py-[24px] md:pb-[90px]"
        >
          {/* Header: view tabs + global account scope */}
          <div className="md:col-span-2 flex flex-wrap items-center gap-[10px]">
            <SpendingViewTabs view={view} dueCount={planned.dueCount} />
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
              balancesLoading={loading || !deltas}
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
                {activity ? (
                  <>
                    <DaysCard
                      calendar={activity.calendar}
                      loading={!activity.cashflow}
                      mode={views.period.mode}
                      periodLabel={views.period.label}
                      calOpen={calOpen}
                      onSetMode={period.changeMode}
                      onPrev={() => period.step(-1)}
                      onNext={() => period.step(1)}
                      todayIs={views.period.todayIs}
                      onToday={period.goToToday}
                      onToggleCal={() => setCalOpen((o) => !o)}
                      onPickMonth={period.pickMonth}
                      onPickDay={period.pickDay}
                    />
                    <CashflowHeroCard
                      view={activity.cashflow}
                      periodLabel={views.period.label}
                    />
                    <TransactionList
                      view={activity.list}
                      onAdd={editor.openAddTx}
                      onRowClick={onRowClick}
                    />
                  </>
                ) : null}
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
                    symbol={loading ? null : currencySymbol(activeCurrency)}
                    wallets={wallets}
                    base={base}
                    rates={inputs.rates}
                  />
                </div>
                <BreakdownCard
                  view={activity?.breakdown ?? null}
                  periodLabel={views.period.label}
                />
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

      {deltas ? (
        <ConnectedTxEditor
          editor={editor}
          wallets={editorWallets}
          archivedWalletIds={archivedWalletIds}
          goals={goals}
          base={base}
          data={inputs}
          deltas={deltas}
        />
      ) : null}

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
