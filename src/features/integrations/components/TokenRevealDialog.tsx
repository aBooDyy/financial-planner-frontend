import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
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
  return (
    <ResponsiveDialog
      open={token !== null}
      onOpenChange={() => undefined}
      dismissible={false}
      title={title}
      description="This is the only time Means will show this key."
    >
      {token !== null ? (
        <RevealBody
          key={token}
          token={token}
          continueLabel={continueLabel}
          onContinue={onContinue}
        />
      ) : null}
    </ResponsiveDialog>
  )
}

function RevealBody({
  token,
  continueLabel,
  onContinue,
}: {
  token: string
  continueLabel: string
  onContinue: () => void
}) {
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setUnlocked(true), REVEAL_UNLOCK_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col gap-4 pt-2">
      <CopyField
        value={token}
        label="Integration key"
        onCopied={() => setUnlocked(true)}
      />
      <div className="flex items-start gap-2.5 rounded-xl bg-fp-surface-2 p-3 text-[12.5px] leading-relaxed text-fp-text-2">
        <TriangleAlert
          size={16}
          strokeWidth={1.9}
          className="mt-px shrink-0 text-fp-warn"
        />
        <span>
          Copy it into your app now. If you lose it, rotate the key for a new
          secret.
        </span>
      </div>
      <Button
        type="button"
        disabled={!unlocked}
        onClick={onContinue}
        className="mb-2 self-end"
      >
        {continueLabel}
      </Button>
    </div>
  )
}
