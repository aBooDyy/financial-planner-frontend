import { Chip, ChipRow } from '#/components/dialog/Chip'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { WalletSelect } from '#/features/wallets/components/WalletSelect'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import type { CreatedKey, NewKey } from '#/features/integrations/api/types'
import {
  KEY_NAME_MAX,
  useCreateKeyForm,
} from '#/features/integrations/hooks/useCreateKeyForm'
import type { KeyOutcome } from '#/features/integrations/hooks/useIntegrationKeys'
import { ExpiryField } from './ExpiryField'

/** Naming a key is the one field people stall on, so the examples name it for them. */
const EXAMPLES = ['Tasker', 'n8n', 'Shortcuts']

type Props = {
  open: boolean
  initialName: string
  online: boolean
  walletGroups: WalletGroupOption[]
  create: (draft: NewKey) => Promise<KeyOutcome<CreatedKey>>
  onCreated: (created: CreatedKey) => void
  onClose: () => void
}

/** Step one of two: name the key. Step two, the secret, is `TokenRevealDialog`. */
export function CreateKeyDialog({
  open,
  initialName,
  online,
  walletGroups,
  create,
  onCreated,
  onClose,
}: Props) {
  const form = useCreateKeyForm(initialName, create, onCreated)
  const error = form.errorFor
  const general = form.general

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="New key"
      footer={
        <DialogActions
          hint={
            online
              ? null
              : 'You’re offline. A key can only be made by the server.'
          }
          onCancel={onClose}
          submitLabel={form.saving ? 'Creating…' : 'Create'}
          submitType="submit"
          form="create-key-form"
          disabled={!online || !form.valid || form.saving}
        />
      }
    >
      <form
        id="create-key-form"
        className="flex flex-col gap-[14px]"
        onSubmit={(e) => {
          e.preventDefault()
          void form.submit()
        }}
      >
        <FormRow id="new-key-name" label="Name" error={error('name')}>
          <Input
            id="new-key-name"
            autoFocus
            value={form.draft.name}
            maxLength={KEY_NAME_MAX}
            placeholder="Tasker — SMS alerts"
            aria-invalid={error('name') ? true : undefined}
            onChange={(e) => form.set('name', e.target.value)}
          />
          {form.draft.name.trim() === '' ? (
            <div className="mt-2">
              <ChipRow label="Example names">
                {EXAMPLES.map((name) => (
                  <Chip
                    key={name}
                    active={false}
                    onClick={() => form.set('name', name)}
                  >
                    {name}
                  </Chip>
                ))}
              </ChipRow>
            </div>
          ) : null}
        </FormRow>
        <FormRow
          id="new-key-wallet"
          label="Default account"
          optional
          error={error('defaultWalletId')}
          help="Where its transactions land unless a rule says otherwise."
        >
          <WalletSelect
            id="new-key-wallet"
            value={form.draft.defaultWalletId}
            onChange={(v) => form.set('defaultWalletId', v)}
            walletGroups={walletGroups}
            invalid={Boolean(error('defaultWalletId'))}
          />
        </FormRow>
        <FormRow id="new-key-expiry" label="Expires" error={error('expiresAt')}>
          <ExpiryField
            id="new-key-expiry"
            variant="chips"
            value={form.draft.expiresAt}
            onChange={(v) => form.set('expiresAt', v)}
            invalid={Boolean(error('expiresAt'))}
          />
        </FormRow>
        {general ? (
          <NoteBox tone="danger">
            <span role="alert">{general}</span>
          </NoteBox>
        ) : null}
      </form>
    </ResponsiveDialog>
  )
}
