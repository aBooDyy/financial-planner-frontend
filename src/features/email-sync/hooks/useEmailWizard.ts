import { useCallback, useState } from 'react'
import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import type {
  EmailConnection,
  EmailProvider,
  InboxMessage,
  RuleDraftWire,
} from '#/features/email-sync/api/types'
import { saveRules } from '#/features/email-sync/data/mutations'

export type WizardStep = 'idle' | 'provider' | 'connecting' | 'select' | 'map'

export type FieldTarget = 'amount' | 'currency' | 'merchant'
/** Amount and currency are required to save a rule; the merchant pick is optional. */
type Mapping = {
  amountIndex: number | null
  currencyIndex: number | null
  merchantIndex: number | null
}
const BLANK_MAPPING: Mapping = {
  amountIndex: null,
  currencyIndex: null,
  merchantIndex: null,
}
const FIELD_KEY: Record<FieldTarget, keyof Mapping> = {
  amount: 'amountIndex',
  currency: 'currencyIndex',
  merchant: 'merchantIndex',
}

type WizardState = {
  step: WizardStep
  provider: EmailProvider | null
  connectionId: string | null
  messages: InboxMessage[]
  selected: Record<string, boolean>
  mappings: Record<string, Mapping>
  mapIndex: number
  target: FieldTarget
  busy: boolean
  error: string | null
}

const INITIAL: WizardState = {
  step: 'idle',
  provider: null,
  connectionId: null,
  messages: [],
  selected: {},
  mappings: {},
  mapIndex: 0,
  target: 'amount',
  busy: false,
  error: null,
}

export function useEmailWizard() {
  const [state, setState] = useState<WizardState>(INITIAL)
  const patch = useCallback(
    (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p })),
    [],
  )

  const start = useCallback(
    () => setState({ ...INITIAL, step: 'provider' }),
    [],
  )
  const cancel = useCallback(() => setState(INITIAL), [])
  const pickProvider = useCallback(
    (provider: EmailProvider) => patch({ provider }),
    [patch],
  )

  /** Kick off the provider OAuth redirect; the browser leaves and returns to the callback. */
  const beginConnect = useCallback(async () => {
    if (!state.provider) return
    patch({ busy: true, error: null })
    try {
      const { authorize_url } = await emailSyncApi.authorizeUrl(state.provider)
      window.location.assign(authorize_url)
    } catch {
      patch({ busy: false, error: 'Could not start the inbox sign-in.' })
    }
  }, [state.provider, patch])

  /** Resume after OAuth: a PENDING_SETUP connection exists; load its inbox to pick senders. */
  const resumeSetup = useCallback(async (connection: EmailConnection) => {
    setState({
      ...INITIAL,
      step: 'connecting',
      provider: connection.provider,
      connectionId: connection.id,
    })
    try {
      const messages = await emailSyncApi.listMessages(connection.id)
      const suggested: Record<string, boolean> = {}
      for (const m of messages) if (m.likely) suggested[m.id] = true
      setState((s) => ({
        ...s,
        step: 'select',
        messages,
        selected: suggested,
      }))
    } catch {
      setState((s) => ({
        ...s,
        step: 'select',
        error: 'Could not load your inbox. Try again.',
      }))
    }
  }, [])

  const toggleSelect = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        selected: { ...s.selected, [id]: !s.selected[id] },
      })),
    [],
  )
  const selectSuggested = useCallback(
    () =>
      setState((s) => {
        const next: Record<string, boolean> = {}
        for (const m of s.messages) if (m.likely) next[m.id] = true
        return { ...s, selected: next }
      }),
    [],
  )
  const clearSelection = useCallback(() => patch({ selected: {} }), [patch])

  const selectedIds = state.messages
    .filter((m) => state.selected[m.id])
    .map((m) => m.id)

  const goToMap = useCallback(() => {
    setState((s) => {
      const ids = s.messages.filter((m) => s.selected[m.id]).map((m) => m.id)
      const mappings = { ...s.mappings }
      for (const id of ids) {
        if (!(id in mappings)) mappings[id] = BLANK_MAPPING
      }
      return { ...s, step: 'map', mappings, mapIndex: 0, target: 'amount' }
    })
  }, [])

  const setMapIndex = useCallback(
    (mapIndex: number) => patch({ mapIndex, target: 'amount' }),
    [patch],
  )
  const setTarget = useCallback(
    (target: FieldTarget) => patch({ target }),
    [patch],
  )

  /** Assign the tapped body-line to the active field, then advance to the other field. */
  const assignLine = useCallback((lineIndex: number) => {
    setState((s) => {
      const ids = s.messages.filter((m) => s.selected[m.id]).map((m) => m.id)
      const id = ids[s.mapIndex]
      if (!id) return s
      const current = s.mappings[id] ?? BLANK_MAPPING
      const next = { ...current, [FIELD_KEY[s.target]]: lineIndex }
      // Amount and currency hop to each other until both are set; merchant is a standalone,
      // optional pick, so tapping there keeps the target where the user put it.
      const nextTarget =
        s.target === 'amount' && next.currencyIndex == null
          ? 'currency'
          : s.target === 'currency' && next.amountIndex == null
            ? 'amount'
            : s.target
      return {
        ...s,
        mappings: { ...s.mappings, [id]: next },
        target: nextTarget,
      }
    })
  }, [])

  const backToSelect = useCallback(() => patch({ step: 'select' }), [patch])

  /** Persist one rule per unique sender (last mapping wins) and mark the connection connected. */
  const finish = useCallback(async (): Promise<EmailConnection | null> => {
    if (!state.connectionId) return null
    const drafts: RuleDraftWire[] = []
    const bySender = new Map<string, number>()
    for (const id of selectedIds) {
      const m = state.messages.find((x) => x.id === id)
      const map = state.mappings[id]
      if (!m || map.amountIndex == null || map.currencyIndex == null) continue
      const draft: RuleDraftWire = {
        sender_email: m.senderEmail,
        sender_name: m.senderName,
        body_lines: m.bodyLines,
        amount_index: map.amountIndex,
        currency_index: map.currencyIndex,
        merchant_index: map.merchantIndex,
        default_category: null,
      }
      const existing = bySender.get(m.senderEmail.toLowerCase())
      if (existing != null) drafts[existing] = draft
      else {
        bySender.set(m.senderEmail.toLowerCase(), drafts.length)
        drafts.push(draft)
      }
    }
    if (drafts.length === 0) return null
    patch({ busy: true, error: null })
    try {
      const connection = await saveRules(state.connectionId, drafts)
      setState(INITIAL)
      return connection
    } catch {
      patch({
        busy: false,
        error: 'Could not save your selections. Try again.',
      })
      return null
    }
  }, [state.connectionId, state.messages, state.mappings, selectedIds, patch])

  const isMapped = useCallback(
    (id: string) => {
      const m = state.mappings[id]
      return m.amountIndex != null && m.currencyIndex != null
    },
    [state.mappings],
  )

  return {
    state,
    selectedIds,
    isMapped,
    actions: {
      start,
      cancel,
      pickProvider,
      beginConnect,
      resumeSetup,
      toggleSelect,
      selectSuggested,
      clearSelection,
      goToMap,
      setMapIndex,
      setTarget,
      assignLine,
      backToSelect,
      finish,
    },
  }
}

export type EmailWizard = ReturnType<typeof useEmailWizard>
