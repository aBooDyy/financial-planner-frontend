import { useState } from 'react'
import { SkipForward } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { Button } from '#/components/ui/button'
import type { ConfirmForm } from '#/features/planned/hooks/useConfirmForm'
import { MovePlannedPanel } from './MovePlannedPanel'

/** 1d's secondary actions: Move date (inline panel) · Skip this one · Close the rest. */
export function ConfirmPlannedSecondary({ f }: { f: ConfirmForm }) {
  const [askingSkip, setAskingSkip] = useState(false)
  if (!f.form || !f.item) return null
  const partial = f.settled > 0

  if (f.form.moveDate !== null) return <MovePlannedPanel f={f} />

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="quiet"
        size="dialog"
        className="flex-auto"
        onClick={f.startMove}
        disabled={f.busy}
      >
        Move date
      </Button>
      {partial ? (
        <Button
          type="button"
          variant="quiet"
          size="dialog"
          className="flex-auto"
          onClick={f.closeRest}
          disabled={f.busy}
        >
          Close the rest
        </Button>
      ) : (
        <Button
          type="button"
          variant="quiet"
          size="dialog"
          className="flex-auto"
          onClick={() => setAskingSkip(true)}
          disabled={f.busy}
        >
          Skip this one
        </Button>
      )}
      <ConfirmDialog
        open={askingSkip}
        onOpenChange={setAskingSkip}
        tone="neutral"
        icon={<SkipForward />}
        title={`Skip “${f.item.name}”?`}
        confirmLabel="Skip it"
        onConfirm={() => {
          setAskingSkip(false)
          void f.skip()
        }}
      >
        <p>It leaves your plan and nothing is recorded for it.</p>
      </ConfirmDialog>
    </div>
  )
}
