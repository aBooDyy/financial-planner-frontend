import { useState } from 'react'
import { OFFLINE_HINT, OfflineNotice } from '#/components/OfflineNotice'
import { NoteBox } from '#/components/dialog/NoteBox'
import type { Passkey } from '#/features/passkeys/api/types'
import { usePasskeyRegistration } from '#/features/passkeys/hooks/usePasskeyRegistration'
import { usePasskeys } from '#/features/passkeys/hooks/usePasskeys'
import { useResumedSetup } from '#/features/passkeys/hooks/useResumedSetup'
import {
  passkeysSupported,
  platformLabel,
} from '#/features/passkeys/passkeySupport'
import { SectionHeader } from '#/features/settings/components/SectionHeader'
import { AddPasskeyButton } from './AddPasskeyButton'
import { PasskeyList } from './PasskeyList'
import { PasskeySetupDialog } from './PasskeySetupDialog'
import { RemovePasskeyDialog } from './RemovePasskeyDialog'
import { RenamePasskeyDialog } from './RenamePasskeyDialog'

const UNSUPPORTED = 'This browser can’t create passkeys.'

/** Settings › Sign-in & security: the user's passkeys, and adding one. */
export function SecuritySection() {
  const model = usePasskeys()
  const flow = usePasskeyRegistration(model.added)
  const [label] = useState(platformLabel)
  const [supported] = useState(passkeysSupported)
  const [renaming, setRenaming] = useState<Passkey | null>(null)
  const [removing, setRemoving] = useState<Passkey | null>(null)
  const addReason = !supported
    ? UNSUPPORTED
    : !model.online
      ? OFFLINE_HINT
      : null

  const { resuming, endResume } = useResumedSetup()
  const closeSetup = () => {
    endResume()
    flow.reset()
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Sign-in & security"
        subtitle="How you sign in to Means."
      />

      {!model.online ? (
        <OfflineNotice>
          You’re offline. Your passkeys show and change once you’re back online.
        </OfflineNotice>
      ) : model.loadError ? (
        <p role="status" className="text-[12.5px] text-fp-text-2">
          Couldn’t load your passkeys. {model.loadError}
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-extrabold">Passkeys</h2>
        <AddPasskeyButton
          reason={addReason}
          busy={flow.busy}
          onAdd={flow.start}
        />
      </div>

      {!resuming && flow.phase === 'idle' && flow.error ? (
        <NoteBox tone="danger">
          <span role="alert">{flow.error}</span>
        </NoteBox>
      ) : null}

      {model.online || model.passkeys ? (
        <PasskeyList
          passkeys={model.passkeys}
          online={model.online}
          onRename={setRenaming}
          onRemove={setRemoving}
        />
      ) : null}

      <PasskeySetupDialog
        flow={flow}
        label={label}
        onClose={closeSetup}
        intro={
          resuming
            ? {
                title: 'Finish adding your passkey',
                dismissLabel: 'Cancel',
                body: (
                  <p className="text-[13.5px] leading-[1.55] text-fp-text-2">
                    You’re verified. Set up {label} to sign in to Means on this
                    device.
                  </p>
                ),
              }
            : undefined
        }
      />

      {renaming ? (
        <RenamePasskeyDialog
          key={renaming.id}
          passkey={renaming}
          online={model.online}
          onRename={(name) => model.rename(renaming.id, name)}
          onClose={() => setRenaming(null)}
        />
      ) : null}

      {removing ? (
        <RemovePasskeyDialog
          key={removing.id}
          passkey={removing}
          onRemove={() => model.remove(removing.id)}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  )
}
