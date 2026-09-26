import { useState } from 'react'
import type { ReactNode } from 'react'
import { Archive } from 'lucide-react'
import type { LocalBalanceNode } from '#/db/types'
import { NODE_COLORS, ROOT_PARENT } from '#/features/wallets/constants'
import { groupParentOptions } from '#/features/wallets/data/selectors'
import type {
  EditorDraft,
  EditorState,
} from '#/features/wallets/hooks/useNodeEditor'
import { ColorSwatches } from '#/components/dialog/ColorSwatches'
import { DialogActions } from '#/components/dialog/DialogActions'
import { FieldLabel } from '#/components/FieldLabel'
import { FormRow } from '#/components/FormRow'
import { IconPicker } from '#/components/icons/IconPicker'
import { GROUP_ICON, WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { BalanceNowStrip } from './BalanceNowStrip'
import { NodeIdentityRow } from './NodeIdentityRow'
import { OpeningBalanceField } from './OpeningBalanceField'

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
  /** A saved wallet's live balance; `null` while it loads, absent for anything else. */
  currentBalance?: string | null
  onAdjust?: () => void
  /** A dialog opened from this one; nested so using it cannot close the editor. */
  children?: ReactNode
}

const OPENING_HELP =
  'The figure it started with; the live balance adds everything after it. Changing the currency doesn’t convert it.'

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
      title={`${id ? 'Edit ' : 'New '}${mode}`}
      contentClassName="sm:max-w-[440px]"
      footer={
        <DialogActions
          onDelete={id ? onDelete : undefined}
          extra={
            id ? (
              <Button
                type="button"
                variant="quiet"
                size="dialog"
                onClick={onArchive}
                title={`Archive this ${mode}`}
                className="gap-[6px] px-[14px]"
              >
                <Archive strokeWidth={1.9} />
                Archive
              </Button>
            ) : null
          }
          onCancel={id ? undefined : onClose}
          submitLabel={id ? 'Save changes' : `Add ${mode}`}
          onSubmit={onSave}
        />
      }
    >
      <NodeIdentityRow
        icon={iconIdOr(draft.icon, isWallet ? WALLET_ICON : GROUP_ICON)}
        color={draft.color}
        name={draft.name}
        namePlaceholder={isWallet ? 'e.g. Main checking' : 'e.g. Al Rajhi Bank'}
        onName={(name) => onField('name', name)}
        onChangeIcon={() => setPickingIcon(true)}
      />

      {isWallet ? (
        <OpeningBalanceField
          label={id ? 'Opening balance' : 'Balance'}
          help={id ? OPENING_HELP : undefined}
          amount={draft.amount}
          currency={draft.currency}
          onAmount={(v) => onField('amount', v)}
          onCurrency={(code) => onField('currency', code)}
        />
      ) : null}

      {isWallet && onAdjust && currentBalance !== undefined ? (
        <BalanceNowStrip balance={currentBalance} onAdjust={onAdjust} />
      ) : null}

      <div>
        <FieldLabel>Colour tag</FieldLabel>
        <ColorSwatches
          label="Colour tag"
          colors={NODE_COLORS}
          value={draft.color}
          onChange={(color) => onField('color', color)}
        />
      </div>

      <FormRow id="node-parent" label="Place inside">
        <Select
          value={draft.parentId}
          onValueChange={(v) => onField('parentId', v)}
        >
          <SelectTrigger id="node-parent">
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
      </FormRow>

      <FormRow id="node-note" label="Note" optional>
        <Textarea
          id="node-note"
          value={draft.note}
          onChange={(e) => onField('note', e.target.value)}
          rows={2}
          placeholder="Add context…"
          className="resize-y"
        />
      </FormRow>

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
