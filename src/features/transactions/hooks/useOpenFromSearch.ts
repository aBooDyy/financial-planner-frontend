import { useEffect, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { db } from '#/db/db'
import { readTransferLegs } from '#/features/transactions/data/ledgerReads'
import { parseOpenParam } from '#/features/transactions/data/openParam'
import type { OpenIntent } from '#/features/transactions/data/openParam'
import type { SpendingInputs } from '#/features/transactions/data/selectors'
import type { AdjustmentEditor } from '#/features/transactions/hooks/useAdjustmentEditor'
import type { TxEditorApi } from '#/features/transactions/hooks/useTxEditor'

type Openers = {
  editor: TxEditorApi
  adjustment: AdjustmentEditor
  inputs: SpendingInputs
  openPlanned: (id: string) => void
}

async function openIntent(
  intent: OpenIntent,
  { editor, adjustment, inputs, openPlanned }: Openers,
) {
  switch (intent.kind) {
    case 'tx':
    case 'adjustment': {
      const t = await db.transactions.get(intent.id)
      if (!t || t.deleted !== 0) return
      if (intent.kind === 'adjustment') adjustment.openEdit(t)
      else editor.openEditTx(t)
      return
    }
    case 'transfer': {
      const legs = await readTransferLegs(intent.id)
      editor.openEditTransfer(intent.id, legs)
      return
    }
    case 'budget': {
      const b = inputs.budgets.find((x) => x.id === intent.id)
      if (b && b.deleted === 0) editor.openEditBudget(b)
      return
    }
    case 'planned':
      openPlanned(intent.id)
  }
}

/**
 * Opens what `?open=` names once the page's data has loaded, then drops the param so a reload
 * or a back step doesn't reopen it. Re-arms whenever the param changes, so it also works when
 * the page is already on screen.
 */
export function useOpenFromSearch(ready: boolean, openers: Openers) {
  const open = useSearch({ from: '/transactions' }).open
  const navigate = useNavigate()
  const handled = useRef<string | null>(null)
  const latest = useRef(openers)
  latest.current = openers

  useEffect(() => {
    if (!open) {
      handled.current = null
      return
    }
    if (!ready || handled.current === open) return
    handled.current = open
    const intent = parseOpenParam(open)
    if (intent) void openIntent(intent, latest.current)
    void navigate({
      to: '.',
      search: (prev) => ({ ...prev, open: undefined }),
      replace: true,
    })
  }, [open, ready, navigate])
}
