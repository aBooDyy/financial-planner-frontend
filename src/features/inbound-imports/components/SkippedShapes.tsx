import { useEffect, useState } from 'react'
import { EyeOff } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'
import { inboundImportsApi } from '#/features/inbound-imports/api/inboundImportsApi'
import type { SkipParent } from '#/features/inbound-imports/api/types'
import { messageForApiError } from '#/lib/errorMessages'

type Props = {
  parent: SkipParent
  /** What the source's messages are called: email / emails, delivery / deliveries. */
  noun: { one: string; many: string }
  online: boolean
}

type State =
  | { kind: 'idle' }
  | { kind: 'count'; count: number }
  | { kind: 'forgotten' }
  | { kind: 'failed'; message: string }

/**
 * How many kinds of message this source skips because the user said "Not a transaction", with
 * a way to take that back. Silent until there is something to say.
 */
export function SkippedShapes({ parent, noun, online }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [busy, setBusy] = useState(false)
  const { connectionId, keyId } = parent

  useEffect(() => {
    if (!online) return
    let active = true
    const target: SkipParent = connectionId
      ? { connectionId }
      : { keyId: keyId ?? '' }
    inboundImportsApi
      .skipCount(target)
      .then((count) => {
        if (active) setState({ kind: 'count', count })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [online, connectionId, keyId])

  if (state.kind === 'idle' || (state.kind === 'count' && state.count === 0))
    return null

  const forget = async () => {
    setBusy(true)
    try {
      await inboundImportsApi.clearSkips(parent)
      setState({ kind: 'forgotten' })
    } catch (err) {
      setState({ kind: 'failed', message: messageForApiError(err) })
    } finally {
      setBusy(false)
    }
  }

  if (state.kind === 'forgotten') {
    return (
      <NoteBox tone="neutral" icon={<EyeOff />}>
        Forgotten — {noun.many} like those will reach your review queue again.
      </NoteBox>
    )
  }
  if (state.kind === 'failed') {
    return (
      <NoteBox tone="danger">
        <span role="alert">{state.message}</span>
      </NoteBox>
    )
  }

  return (
    <NoteBox tone="neutral" icon={<EyeOff />}>
      <span>
        {state.count === 1
          ? `1 kind of ${noun.one} is`
          : `${state.count} kinds of ${noun.one} are`}{' '}
        skipped because you marked one as not a transaction.{' '}
        <button
          type="button"
          onClick={() => void forget()}
          disabled={busy || !online}
          className="font-bold text-fp-accent-ink hover:underline disabled:opacity-50"
        >
          Forget them
        </button>
      </span>
    </NoteBox>
  )
}
