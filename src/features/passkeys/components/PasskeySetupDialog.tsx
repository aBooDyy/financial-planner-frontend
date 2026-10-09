import type { ReactNode } from 'react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { DoneState } from '#/components/dialog/DoneState'
import { NoteBox } from '#/components/dialog/NoteBox'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { PasskeyRegistration } from '#/features/passkeys/hooks/usePasskeyRegistration'
import type { PlatformLabel } from '#/features/passkeys/passkeySupport'
import { setUpLabel } from '#/features/passkeys/passkeySupport'
import {
  CONFIRM_PASSWORD_FORM_ID,
  ConfirmPasswordForm,
} from './ConfirmPasswordForm'

type Props = {
  flow: PasskeyRegistration
  label: PlatformLabel
  onClose: () => void
  /** The offer that opens the dialog before any step; without it the dialog shows only for a step. */
  intro?: { title: string; body: ReactNode; dismissLabel: string }
}

type Step = {
  title: string
  description?: string
  body: ReactNode
  footer?: ReactNode
  hideHeader?: boolean
}

const doneTitle = (label: PlatformLabel) =>
  label === 'a passkey' ? 'Your passkey is set up' : `${label} is set up`

/**
 * Every step of adding a passkey that needs the user: the offer (when there is one), proving
 * it's them, and the result. The browser's own passkey sheet runs in between, outside it.
 */
export function PasskeySetupDialog({ flow, label, onClose, intro }: Props) {
  const errorNote = flow.error ? (
    <NoteBox tone="danger">
      <span role="alert">{flow.error}</span>
    </NoteBox>
  ) : null

  const stepFor = (): Step | null => {
    switch (flow.phase) {
      case 'password':
        return {
          title: 'Confirm it’s you',
          description: 'Enter your password to add a passkey to your account.',
          body: (
            <ConfirmPasswordForm
              error={flow.error}
              onSubmit={flow.confirmPassword}
            />
          ),
          footer: (
            <DialogActions
              onCancel={flow.reset}
              submitLabel={flow.busy ? 'Checking…' : 'Continue'}
              submitType="submit"
              form={CONFIRM_PASSWORD_FORM_ID}
              disabled={flow.busy}
            />
          ),
        }
      case 'google':
        return {
          title: 'Confirm it’s you',
          description: 'Sign in with Google again before adding a passkey.',
          body: (
            <>
              <p className="text-[13.5px] leading-[1.55] text-fp-text-2">
                You’ll come straight back here, and setup carries on where it
                left off.
              </p>
              {errorNote}
            </>
          ),
          footer: (
            <DialogActions
              onCancel={flow.reset}
              submitLabel={
                flow.googlePending ? 'Connecting…' : 'Verify with Google'
              }
              onSubmit={flow.verifyWithGoogle}
              disabled={flow.googlePending}
            />
          ),
        }
      case 'done':
        return {
          title: doneTitle(label),
          hideHeader: true,
          body: (
            <DoneState
              title={doneTitle(label)}
              sub={`Next time, sign in with ${label} — no password to type.`}
              onDone={onClose}
            />
          ),
        }
      case 'idle':
        return intro
          ? {
              title: intro.title,
              body: (
                <>
                  {intro.body}
                  {errorNote}
                </>
              ),
              footer: (
                <DialogActions
                  onCancel={onClose}
                  cancelLabel={intro.dismissLabel}
                  submitLabel={flow.busy ? 'Setting up…' : setUpLabel(label)}
                  onSubmit={flow.start}
                  disabled={flow.busy}
                />
              ),
            }
          : null
    }
  }

  const step = stepFor()
  // Leaving a re-verify step returns to where it began rather than closing the offer.
  const close = () =>
    flow.phase === 'password' || flow.phase === 'google'
      ? flow.reset()
      : onClose()

  return (
    <ResponsiveDialog
      open={step !== null}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      dismissible={!flow.busy}
      title={step?.title ?? ''}
      description={step?.description}
      hideHeader={step?.hideHeader}
      footer={step?.footer}
    >
      {step?.body}
    </ResponsiveDialog>
  )
}
