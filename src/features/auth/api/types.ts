export type User = {
  id: string
  email: string
  name: string
  /** Null until the user finishes first-run setup (`/setup`). */
  onboardedAt: string | null
  /** False for an account opened with Google that never set a password. */
  hasPassword: boolean
  createdAt: string
  updatedAt: string
  version: string
}

export type RegisterPayload = { name: string; email: string; password: string }
export type LoginPayload = { email: string; password: string }

/** Wire shape (snake_case) as returned by the backend inside the response envelope's `data`. */
export type UserWire = {
  id: string
  email: string
  name: string
  onboarded_at: string | null
  has_password: boolean
  created_at: string
  updated_at: string
  version: string
}

/** `POST /auth/google/authorize-url` payload — the consent URL plus the signed state. */
export type AuthorizeUrlWire = { authorize_url: string; state: string }

export const toUser = (wire: UserWire): User => ({
  id: wire.id,
  email: wire.email,
  name: wire.name,
  onboardedAt: wire.onboarded_at,
  hasPassword: wire.has_password,
  createdAt: wire.created_at,
  updatedAt: wire.updated_at,
  version: wire.version,
})
