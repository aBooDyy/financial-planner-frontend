import type { LocalBalanceNode } from '#/db/types'
import { NODE_COLORS, ROOT_PARENT } from '#/features/balances/constants'
import { groupParentOptions } from '#/features/balances/data/selectors'
import type {
  EditorDraft,
  EditorState,
} from '#/features/balances/hooks/useNodeEditor'
import { SUPPORTED_CURRENCIES } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
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
  onDelete: () => void
  onClose: () => void
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

export function NodeEditor({
  editing,
  nodes,
  onField,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { mode, id, draft } = editing
  const isWallet = mode === 'wallet'
  const parentOptions = groupParentOptions(nodes, id)

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
              <Label className={LABEL}>Balance</Label>
              <Input
                value={draft.amount}
                onChange={(e) => onField('amount', e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="tabular-nums"
              />
            </div>
            <div className="w-[106px]">
              <Label className={LABEL}>Currency</Label>
              <Select
                value={draft.currency}
                onValueChange={(v) => onField('currency', v as CurrencyCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
    </ResponsiveDialog>
  )
}
