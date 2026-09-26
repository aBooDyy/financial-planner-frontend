import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { NoteBox } from '#/components/dialog/NoteBox'
import { CopyField } from './CopyField'

/** Long enough to select the text by hand; short enough not to feel like a lock. */
export const REVEAL_UNLOCK_MS = 8000

type Props = {
  /** The secret, or null when there is nothing to show. Never persisted anywhere. */
  token: string | null
  title: string
  continueLabel: string
  onContinue: () => void
}

/**
 * The one time a secret exists on screen. Closing it before copying costs the user a
 * rotation, so it cannot be dismissed — no close button, no backdrop, no Escape — and
 * Continue waits until the key was copied or a few seconds have passed.
 */
export function TokenRevealDialog({
  token,
  title,
  continueLabel,
  onContinue,
}: Props) {
  const { unlocked, unlock } = useUnlock(token)
  return (
    <ResponsiveDialog
      open={token !== null}
      onOpenChange={() => undefined}
      dismissible={false}
      title={title}
      description="This is the only time Means will show this key."
      footer={
        <Button
          type="button"
          size="dialog"
          disabled={!unlocked}
          onClick={onContinue}
          className="flex-1"
        >
          {continueLabel}
        </Button>
      }
    >
      {token !== null ? (
        <>
          <CopyField
            key={token}
            value={token}
            label="Integration key"
            onCopied={unlock}
          />
          <NoteBox tone="warn" icon={<TriangleAlert />}>
            Copy it into your app now. If you lose it, rotate the key for a new
            secret.
          </NoteBox>
        </>
      ) : null}
    </ResponsiveDialog>
  )
}

/** Continue unlocks on a copy, or once the wait has passed — per secret shown. */
function useUnlock(token: string | null) {
  const [unlockedFor, setUnlockedFor] = useState<string | null>(null)

  useEffect(() => {
    if (token === null) return
    const timer = setTimeout(() => setUnlockedFor(token), REVEAL_UNLOCK_MS)
    return () => clearTimeout(timer)
  }, [token])

  return {
    unlocked: token !== null && unlockedFor === token,
    unlock: () => setUnlockedFor(token),
  }
}
