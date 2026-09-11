import { http } from '#/lib/http'
import { toUser } from './types'
import type {
  AuthorizeUrlWire,
  LoginPayload,
  RegisterPayload,
  User,
  UserWire,
} from './types'

export type UpdateProfilePayload = {
  version: string
  name: string
  email: string
}

export const authApi = {
  register: (payload: RegisterPayload): Promise<User> =>
    http.post<UserWire>('/auth/register', payload).then(toUser),

  login: (payload: LoginPayload): Promise<User> =>
    http.post<UserWire>('/auth/login', payload).then(toUser),

  googleAuthorizeUrl: (): Promise<AuthorizeUrlWire> =>
    http.post<AuthorizeUrlWire>('/auth/google/authorize-url'),

  googleCallback: (code: string, state: string): Promise<User> =>
    http.post<UserWire>('/auth/google/callback', { code, state }).then(toUser),

  logout: (): Promise<unknown> => http.post('/auth/logout'),

  me: (): Promise<User> => http.get<UserWire>('/auth/me').then(toUser),

  updateProfile: (payload: UpdateProfilePayload): Promise<User> =>
    http.patch<UserWire>('/auth/me', payload).then(toUser),
}
