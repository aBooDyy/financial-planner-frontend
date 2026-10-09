import { toUser } from '#/features/auth/api/types'
import type { User, UserWire } from '#/features/auth/api/types'
import { http } from '#/lib/http'
import { toPasskey } from './types'
import type {
  AuthenticationOptions,
  AuthenticationVerifyPayload,
  Passkey,
  PasskeyWire,
  RegistrationOptions,
  RegistrationVerifyPayload,
  RenamePasskeyPayload,
} from './types'

const BASE = '/auth/passkeys'
const passkeyPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`

/**
 * Passkeys are server state the UI calls directly: a ceremony needs the server at both ends,
 * so there is nothing to queue offline.
 */
export const passkeysApi = {
  /** `password` re-authenticates a session that is no longer fresh enough to add a passkey. */
  registrationOptions: (password?: string): Promise<RegistrationOptions> =>
    http.post<RegistrationOptions>(
      `${BASE}/registration/options`,
      password === undefined ? {} : { password },
    ),

  registrationVerify: (payload: RegistrationVerifyPayload): Promise<Passkey> =>
    http
      .post<PasskeyWire>(`${BASE}/registration/verify`, payload)
      .then(toPasskey),

  list: (): Promise<Passkey[]> =>
    http.get<PasskeyWire[]>(BASE).then((rows) => rows.map(toPasskey)),

  rename: (id: string, payload: RenamePasskeyPayload): Promise<Passkey> =>
    http.patch<PasskeyWire>(passkeyPath(id), payload).then(toPasskey),

  remove: (id: string): Promise<void> =>
    http.del<unknown>(passkeyPath(id)).then(() => undefined),

  authenticationOptions: (): Promise<AuthenticationOptions> =>
    http.post<AuthenticationOptions>(`${BASE}/authentication/options`, {}),

  authenticationVerify: (payload: AuthenticationVerifyPayload): Promise<User> =>
    http.post<UserWire>(`${BASE}/authentication/verify`, payload).then(toUser),
}
