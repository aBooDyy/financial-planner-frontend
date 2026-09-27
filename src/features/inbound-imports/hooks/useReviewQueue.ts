import { useEffect, useRef, useState } from 'react'
import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import {
  displayName,
  firstEmpty,
} from '#/features/inbound-imports/data/bodyReads'
import type {
  ReadField,
  ReadValues,
} from '#/features/inbound-imports/data/bodyReads'
import {
  confirmImport,
  dismissImport,
} from '#/features/inbound-imports/data/mutations'
import { readPick } from '#/features/inbound-imports/data/pickValues'
import {
  confirmInput,
  draftState,
  initialDraft,
  resolveDraft,
} from '#/features/inbound-imports/data/reviewDraft'
import type {
  DraftState,
  ReviewDraft,
} from '#/features/inbound-imports/data/reviewDraft'
import type { TxType } from '#/features/transactions/api/types'
import { messageForApiError } from '#/lib/errorMessages'
import { useHeldBatch } from './useHeldBatch'
import type { HeldBatch } from './useHeldBatch'

const NOTICE_MS = 3000

export type QueueToast = { message: string; undo: boolean }

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

const valuesOf = (draft: ReviewDraft): ReadValues => ({
  amount: draft.amount,
  currency: draft.currency,
  merchant: draft.merchant,
})

/**
 * The review queue, one import at a time. Every import's edits live here rather than in its
 * card, so paging keeps them and Confirm all posts what each card would. Ignoring is held for
 * an Undo; confirming is final.
 */
export function useReviewQueue(
  imports: LocalInboundImport[],
  wallets: LocalBalanceNode[],
  catalog: CategoryCatalog,
) {
  const [edits, setEdits] = useState<Record<string, Partial<ReviewDraft>>>({})
  const [picked, setPicked] = useState<Record<string, ReadField>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [index, setIndex] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [heldMessage, setHeldMessage] = useState('')
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(imports)
  useEffect(() => {
    latest.current = imports
  })
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    [],
  )

  const setError = (id: string, message: string | null) =>
    setErrors(({ [id]: _gone, ...rest }) =>
      message ? { ...rest, [id]: message } : rest,
    )

  const sendBatch = async ({ ids, skipSimilar }: HeldBatch) => {
    for (const id of ids) {
      const item = latest.current.find((i) => i.id === id)
      if (!item) continue
      try {
        await dismissImport(item, skipSimilar && item.skippable)
      } catch (err) {
        setError(id, messageForApiError(err))
      }
    }
  }
  const batch = useHeldBatch(sendBatch)

  const showNotice = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }

  const draftOf = (item: LocalInboundImport): ReviewDraft =>
    resolveDraft(
      { ...initialDraft(item, wallets, catalog), ...edits[item.id] },
      item,
      wallets,
      catalog,
    )

  const visible = imports.filter((i) => !batch.hidden.has(i.id))
  const count = visible.length
  const at = count ? ((index % count) + count) % count : 0
  const current = count ? visible[at] : null
  const states = new Map<string, DraftState>(
    visible.map((i) => [i.id, draftState(draftOf(i))]),
  )
  const needsCount = visible.filter(
    (i) => states.get(i.id)?.needsDetails,
  ).length
  const readyItems = visible.filter((i) => states.get(i.id)?.ready)

  const edit = (id: string, patch: Partial<ReviewDraft>) => {
    setEdits((all) => ({ ...all, [id]: { ...all[id], ...patch } }))
    setError(id, null)
  }

  const hold = (ids: string[], skipSimilar: boolean, message: string) => {
    batch.hold({ ids, skipSimilar })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(null)
    setHeldMessage(message)
  }

  const post = async (item: LocalInboundImport): Promise<boolean> => {
    const answer = confirmInput(item, draftOf(item))
    if ('problem' in answer) {
      setError(item.id, answer.problem)
      return false
    }
    try {
      await confirmImport(item, answer.input)
      setEdits(({ [item.id]: _done, ...rest }) => rest)
      return true
    } catch (err) {
      setError(item.id, messageForApiError(err))
      return false
    }
  }

  const card = current ? cardFor(current) : null

  function cardFor(item: LocalInboundImport) {
    const draft = draftOf(item)
    const values = valuesOf(draft)
    const target = picked[item.id] ?? firstEmpty(values)
    return {
      item,
      draft,
      ...draftState(draft),
      target,
      error: errors[item.id] ?? null,
      setTarget: (field: ReadField) =>
        setPicked((all) => ({ ...all, [item.id]: field })),
      setField: <TKey extends keyof ReviewDraft>(
        key: TKey,
        value: ReviewDraft[TKey],
      ) => edit(item.id, { [key]: value }),
      setType: (type: TxType) => edit(item.id, { type }),
      /** Fill `field` from text tapped in the body, then move on to what is still empty. */
      use: (field: ReadField, text: string) => {
        const read = readPick(field, { value: text, text }, draft.currency)
        if (!read) {
          setError(item.id, `“${text.trim()}” doesn’t read as ${NOUN[field]}.`)
          return
        }
        const patch: Partial<ReviewDraft> =
          field === 'merchant'
            ? { merchant: displayName(read.merchant ?? text) }
            : read
        edit(item.id, patch)
        setPicked(({ [item.id]: _was, ...rest }) => rest)
      },
      confirm: async () => {
        setBusy(true)
        if (await post(item)) showNotice('Added to your ledger')
        setBusy(false)
      },
      ignore: () => hold([item.id], false, 'Import ignored'),
      notTransaction: () =>
        hold(
          [item.id],
          true,
          item.skippable
            ? 'Not a transaction — ones like it will be skipped'
            : 'Marked as not a transaction',
        ),
    }
  }

  const toast: QueueToast | null = batch.held
    ? { message: heldMessage, undo: true }
    : notice
      ? { message: notice, undo: false }
      : null

  return {
    count,
    position: at,
    card,
    busy,
    needsCount,
    readyCount: readyItems.length,
    toast,
    prev: () => setIndex(at - 1),
    next: () => setIndex(at + 1),
    undo: batch.undo,
    ignoreAll: () =>
      hold(
        visible.map((i) => i.id),
        false,
        `${plural(count, 'import')} ignored`,
      ),
    confirmAll: async () => {
      setBusy(true)
      let added = 0
      for (const item of readyItems) if (await post(item)) added += 1
      setBusy(false)
      const failed = readyItems.length - added
      showNotice(
        failed
          ? `${added} added · ${failed} couldn’t be added`
          : `${added} added to your ledger`,
      )
    },
  }
}

const NOUN: Record<ReadField, string> = {
  amount: 'an amount',
  currency: 'a currency code',
  merchant: 'a merchant',
}

export type ReviewQueue = ReturnType<typeof useReviewQueue>
export type ReviewCard = NonNullable<ReviewQueue['card']>
