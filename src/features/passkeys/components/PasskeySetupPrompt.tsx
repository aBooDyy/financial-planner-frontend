import { useState } from 'react'
import { usePasskeyRegistration } from '#/features/passkeys/hooks/usePasskeyRegistration'
import { platformLabel } from '#/features/passkeys/passkeySupport'
import { PasskeySetupDialog } from './PasskeySetupDialog'

type Props = { onClose: () => void }

/** The one-time offer after a sign-in. Any way out of it counts as an answer for this device. */
export function PasskeySetupPrompt({ onClose }: Props) {
  const flow = usePasskeyRegistration(() => undefined)
  const [label] = useState(platformLabel)

  return (
    <PasskeySetupDialog
      flow={flow}
      label={label}
      onClose={onClose}
      intro={{
        title: 'Sign in faster next time',
        dismissLabel: 'Not now',
        body: (
          <p className="text-[13.5px] leading-[1.55] text-fp-text-2">
            Use {label} to sign in to Means on this device — no password to
            type. Your password keeps working too.
          </p>
        ),
      }}
    />
  )
}
