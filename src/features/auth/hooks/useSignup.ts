import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { markJustSignedIn } from '#/features/passkeys/data/setupFlags'
import { useSessionStore } from '#/stores/session'
import { authApi } from '../api/authApi'
import { signupSchema } from '../schemas'
import type { SignupValues } from '../schemas'
import { applyApiError } from './applyApiError'

export function useSignup() {
  const navigate = useNavigate()
  const setUser = useSessionStore((s) => s.setUser)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', agree: true },
  })

  const submit = form.handleSubmit(async ({ name, email, password }) => {
    setFormError(null)
    try {
      const user = await authApi.register({ name, email, password })
      setUser(user)
      markJustSignedIn(user.id)
      await navigate({ to: '/' })
    } catch (error) {
      setFormError(
        applyApiError(error, form.setError, ['name', 'email', 'password']),
      )
    }
  })

  return { form, submit, formError }
}
