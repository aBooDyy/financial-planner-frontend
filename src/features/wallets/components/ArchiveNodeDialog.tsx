import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { FieldLabel } from '#/components/FieldLabel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { walletsInsideLine } from '#/features/wallets/data/archivedList'
import type { ArchiveTarget } from '#/features/wallets/data/archivedList'
import { cn } from '#/lib/utils'

/** What happens to the set-asides an archived wallet holds. */
export type HeldChoice = { kind: 'move'; walletId: string } | { kind: 'free' }

type Props = {
  target: ArchiveTarget | null
  /** "SR 1,900.00" set aside in it (or the wallets inside); null when it holds none. */
  heldStr: string | null
  /** The wallets the set-asides can move to. */
  moveTargets: ReadonlyArray<{ id: string; name: string }>
  onClose: () => void
  onConfirm: (choice: HeldChoice | null) => void
}

function consequences(t: ArchiveTarget): string[] {
  const inside = walletsInsideLine(t.walletCount)
  return [
    'It leaves the Wallets page, your totals and every account picker.',
    'Its transactions stay in your history, untouched.',
    ...(inside ? [inside] : []),
    ...(t.holdingStr
      ? [`${t.holdingStr} stops counting toward your total.`]
      : []),
  ]
}

/**
 * Archiving is reversible, so the confirm spells out what changes rather than warning. An
 * archived wallet never holds set-asides (03 §6): when it does, the user moves them to another
 * wallet or frees them first.
 */
export function ArchiveNodeDialog({
  target,
  heldStr,
  moveTargets,
  onClose,
  onConfirm,
}: Props) {
  const firstTarget = moveTargets.at(0)?.id ?? null
  const [kind, setKind] = useState<HeldChoice['kind']>('move')
  const [walletId, setWalletId] = useState<string | null>(firstTarget)
  useEffect(() => {
    setKind(firstTarget ? 'move' : 'free')
    setWalletId(firstTarget)
  }, [target?.id, firstTarget])

  const choice: HeldChoice | null = !heldStr
    ? null
    : kind === 'move' && walletId
      ? { kind: 'move', walletId }
      : { kind: 'free' }

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      tone="neutral"
      title={target ? `Archive “${target.name}”?` : ''}
      bullets={target ? consequences(target) : undefined}
      note="Restore it anytime from Settings › Archived."
      confirmLabel={`Archive ${target?.kind ?? ''}`}
      onConfirm={() => onConfirm(choice)}
    >
      {heldStr ? (
        <div className="mb-3 flex flex-col gap-2">
          <FieldLabel>
            {heldStr} is set aside in it. Archived wallets hold no set-asides.
          </FieldLabel>
          <div
            role="radiogroup"
            aria-label="Its set-asides"
            className="flex flex-col gap-2"
          >
            {moveTargets.length > 0 ? (
              <Option
                active={kind === 'move'}
                onClick={() => setKind('move')}
                label="Move them to"
              >
                <Select
                  value={walletId ?? undefined}
                  onValueChange={(id) => {
                    setWalletId(id)
                    setKind('move')
                  }}
                >
                  <SelectTrigger
                    aria-label="Move them to"
                    className="min-w-0 flex-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {moveTargets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Option>
            ) : null}
            <Option
              active={kind === 'free'}
              onClick={() => setKind('free')}
              label="Free them up"
              sub="They stop being set aside; the bills and goals plan for them again."
            />
          </div>
        </div>
      ) : null}
    </ConfirmDialog>
  )
}

function Option({
  active,
  onClick,
  label,
  sub,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  sub?: string
  children?: ReactNode
}) {
  return (
    <div
      role="radio"
      aria-checked={active}
      aria-label={label}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'flex cursor-pointer flex-wrap items-center gap-2 rounded-[12px] border-[1.5px] px-3 py-[9px] text-start transition',
        active
          ? 'border-fp-accent bg-fp-accent-soft'
          : 'border-fp-border hover:border-fp-border-strong',
      )}
    >
      <span className="text-[13px] font-bold text-fp-text">{label}</span>
      {children}
      {sub ? (
        <span className="w-full text-[12px] text-fp-text-3">{sub}</span>
      ) : null}
    </div>
  )
}
