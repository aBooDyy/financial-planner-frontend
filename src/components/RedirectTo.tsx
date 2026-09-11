import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

type AppRoute = '/' | '/auth/login' | '/auth/signup' | '/balances'

/** Imperative redirect for component-level route guards (no loader context needed). */
export function RedirectTo({ to }: { to: AppRoute }) {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate({ to })
  }, [navigate, to])
  return null
}
