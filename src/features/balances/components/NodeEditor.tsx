import { useState } from 'react'
import type { ReactNode } from 'react'
import { Archive, Scale } from 'lucide-react'
import type { LocalBalanceNode } from '#/db/types'
import { NODE_COLORS, ROOT_PARENT } from '#/features/balances/constants'
import { groupParentOptions } from '#/features/balances/data/selectors'
import type {
  EditorDraft,
  EditorState,
} from '#/features/balances/hooks/useNodeEditor'
import { amountInputProps } from '#/lib/currency'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { IconChip } from '#/components/icons/IconChip'
import { IconPicker } from '#/components/icons/IconPicker'
import { GROUP_ICON, WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'

type Props = {
  editing: EditorState
  nodes: LocalBalanceNode[]
  onField: <TKey extends keyof EditorDraft>(
    field: TKey,
    value: EditorDraft[TKey],
  ) => void
  onSave: () => void
  onArchive: () => void
  onDelete: () => void
  onClose: () => void
  /** A saved wallet's live balance, formatted; absent for a group or a new wallet. */
  currentBalance?: string
  onAdjust?: () => void
  /** A dialog opened from this one; nested so using it cannot close the editor. */
  children?: ReactNode
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

export function NodeEditor({
  editing,
  nodes,
  onField,
  onSave,
  onArchive,
  onDelete,
  onClose,
  currentBalance,
  onAdjust,
  children,
}: Props) {
  const { mode, id, draft } = editing
  const isWallet = mode === 'wallet'
  const parentOptions = groupParentOptions(nodes, id)
  const [pickingIcon, setPickingIcon] = useState(false)

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title={`${id ? 'Edit ' : 'New '}${isWallet ? 'wallet' : 'group'}`}
      contentClassName="sm:max-w-[440px]"
      footer={
        <>
          {id ? (
            <Button
              variant="outline"
              onClick={onDelete}
              className="text-fp-danger hover:border-fp-danger hover:text-fp-danger"
            >
              Delete
            </Button>
          ) : null}
          {id ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onArchive}
              title={`Archive this ${isWallet ? 'wallet' : 'group'}`}
              className="gap-1 px-2 text-[12.5px] font-semibold text-fp-text-3 hover:text-fp-text"
            >
              <Archive size={13} strokeWidth={1.9} />
              Archive
            </Button>
          ) : null}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            {id ? 'Save changes' : `Add ${isWallet ? 'wallet' : 'group'}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[15px]">
        <div className="flex justify-center">
          <button
            type="button"
            aria-label="Change icon"
            onClick={() => setPickingIcon(true)}
            className="rounded-[10px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-fp-text"
          >
            <IconChip
              id={iconIdOr(draft.icon, isWallet ? WALLET_ICON : GROUP_ICON)}
              color={draft.color}
              size={56}
            />
          </button>
        </div>

        <div>
          <Label className={LABEL}>Name</Label>
          <Input
            value={draft.name}
            onChange={(e) => onField('name', e.target.value)}
            placeholder={isWallet ? 'e.g. Main checking' : 'e.g. Al Rajhi Bank'}
          />
        </div>

        {isWallet ? (
          <div className="flex gap-[10px]">
            <div className="flex-1">
              <Label className={LABEL}>
                {id ? 'Opening balance' : 'Balance'}
              </Label>
              <Input
                value={draft.amount}
                onChange={(e) => onField('amount', e.target.value)}
                {...amountInputProps(draft.currency)}
                className="tabular-nums"
              />
            </div>
            <div className="w-[106px]">
              <Label className={LABEL}>Currency</Label>
              <CurrencyPicker
                value={draft.currency}
                onChange={(code) => onField('currency', code)}
                align="end"
              />
            </div>
          </div>
        ) : null}

        {isWallet && onAdjust ? (
          <div className="flex items-center gap-3 rounded-[12px] border border-fp-border bg-fp-surface-2 px-[13px] py-[10px]">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold tracking-[0.05em] text-fp-text-3">
                BALANCE NOW
              </div>
              <div className="truncate text-[14.5px] font-bold text-fp-text tabular-nums">
                {currentBalance}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onAdjust}
              className="flex-none gap-[6px] rounded-[11px] px-3 text-[13px] font-bold hover:border-fp-accent"
            >
              <Scale size={15} strokeWidth={2} />
              Adjust balance
            </Button>
          </div>
        ) : null}

        <div>
          <Label className={LABEL}>Color tag</Label>
          <div className="flex flex-wrap gap-[10px]">
            {NODE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onField('color', color)}
                className="h-[27px] w-[27px] rounded-[8px] ring-1 ring-black/10"
                style={{
                  background: color,
                  outline:
                    draft.color === color
                      ? '2px solid var(--fp-text)'
                      : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <Label className={LABEL}>Place inside</Label>
          <Select
            value={draft.parentId}
            onValueChange={(v) => onField('parentId', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT_PARENT}>— Top level —</SelectItem>
              {parentOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className={LABEL}>
            Note <span className="font-medium text-fp-text-3">(optional)</span>
          </Label>
          <Textarea
            value={draft.note}
            onChange={(e) => onField('note', e.target.value)}
            rows={2}
            placeholder="Add context…"
            className="min-h-[46px] resize-y"
          />
        </div>
      </div>

      <IconPicker
        open={pickingIcon}
        onOpenChange={setPickingIcon}
        value={draft.icon}
        color={draft.color}
        onSelect={(icon) => onField('icon', icon)}
      />
      {children}
    </ResponsiveDialog>
  )
}
