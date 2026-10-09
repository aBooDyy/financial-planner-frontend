import { useState } from 'react'
import { PasswordField } from '#/components/PasswordField'

export const CONFIRM_PASSWORD_FORM_ID = 'passkey-confirm-password'

type Props = {
  error: string | null
  onSubmit: (password: string) => void
}

/** The password that re-opens a session too old to add a passkey on its own. */
export function ConfirmPasswordForm({ error, onSubmit }: Props) {
  const [password, setPassword] = useState('')

  return (
    <form
      id={CONFIRM_PASSWORD_FORM_ID}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (password !== '') onSubmit(password)
      }}
    >
      <PasswordField
        label="Password"
        id="passkey-confirm-password-input"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
      />
    </form>
  )
}
