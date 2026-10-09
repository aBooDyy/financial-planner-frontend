import { createFileRoute } from '@tanstack/react-router'
import { GoogleCallback } from '#/features/auth/components/GoogleCallback'

export const Route = createFileRoute('/auth/google/callback')({
  component: GoogleCallback,
})
