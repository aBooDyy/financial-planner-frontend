import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { WalletGroupOption } from '#/features/balances/data/selectors'
import type { CreatedKey, NewKey } from '#/features/integrations/api/types'
import {
  KEY_NAME_MAX,
  useCreateKeyForm,
} from '#/features/integrations/hooks/useCreateKeyForm'
import type { KeyOutcome } from '#/features/integrations/hooks/useIntegrationKeys'
import { ExpiryField } from './ExpiryField'
import { FormRow } from './FormRow'
import { WalletSelect } from './WalletSelect'

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
        <>
          {online ? (
            <div className="flex-1" />
          ) : (
            <span className="flex-1 text-[12px] text-fp-text-3">
              You’re offline. A key can only be made by the server.
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-key-form"
            disabled={!online || !form.valid || form.saving}
          >
            {form.saving ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        id="create-key-form"
        className="flex flex-col gap-4"
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
        </FormRow>
        <FormRow
          id="new-key-wallet"
          label="Default account"
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
            value={form.draft.expiresAt}
            onChange={(v) => form.set('expiresAt', v)}
            invalid={Boolean(error('expiresAt'))}
          />
        </FormRow>
        {general ? (
          <p role="alert" className="text-[12.5px] text-fp-danger">
            {general}
          </p>
        ) : null}
      </form>
    </ResponsiveDialog>
  )
}
