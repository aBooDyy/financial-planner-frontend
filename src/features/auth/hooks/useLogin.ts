import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { markJustSignedIn } from '#/features/passkeys/data/setupFlags'
import { useSessionStore } from '#/stores/session'
import { authApi } from '../api/authApi'
import { loginSchema } from '../schemas'
import type { LoginValues } from '../schemas'
import { applyApiError } from './applyApiError'

export function useLogin() {
  const navigate = useNavigate()
  const setUser = useSessionStore((s) => s.setUser)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  const submit = form.handleSubmit(async ({ email, password }) => {
    setFormError(null)
    try {
      const user = await authApi.login({ email, password })
      setUser(user)
      markJustSignedIn(user.id)
      await navigate({ to: '/' })
    } catch (error) {
      setFormError(applyApiError(error, form.setError, ['email', 'password']))
    }
  })

  return { form, submit, formError }
}
