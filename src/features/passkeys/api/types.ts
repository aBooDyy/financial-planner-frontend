import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser'

export type PasskeyDeviceType = 'mobile' | 'tablet' | 'desktop' | 'other'

export type Passkey = {
  id: string
  name: string
  providerName: string | null
  deviceType: PasskeyDeviceType | null
  deviceModel: string | null
  osName: string | null
  osVersion: string | null
  browserName: string | null
  browserVersion: string | null
  /** Synced to the user's other devices by their password manager. */
  backedUp: boolean
  backupEligible: boolean
  transports: string[]
  createdAt: string
  lastUsedAt: string | null
  lastUsedDevice: string | null
  updatedAt: string
  version: string
}

export type PasskeyWire = {
  id: string
  name: string
  provider_name: string | null
  device_type: PasskeyDeviceType | null
  device_model: string | null
  os_name: string | null
  os_version: string | null
  browser_name: string | null
  browser_version: string | null
  backed_up: boolean
  backup_eligible: boolean
  transports: string[]
  created_at: string
  last_used_at: string | null
  last_used_device: string | null
  updated_at: string
  version: string
}

/** The challenge travels in the signed `state`; the server keeps nothing between the calls. */
export type RegistrationOptions = {
  options: PublicKeyCredentialCreationOptionsJSON
  state: string
}

export type AuthenticationOptions = {
  options: PublicKeyCredentialRequestOptionsJSON
  state: string
}

export type RegistrationVerifyPayload = {
  state: string
  credential: RegistrationResponseJSON
  name?: string
}

export type AuthenticationVerifyPayload = {
  state: string
  credential: AuthenticationResponseJSON
}

export type RenamePasskeyPayload = { name: string; version: string }

export const toPasskey = (wire: PasskeyWire): Passkey => ({
  id: wire.id,
  name: wire.name,
  providerName: wire.provider_name,
  deviceType: wire.device_type,
  deviceModel: wire.device_model,
  osName: wire.os_name,
  osVersion: wire.os_version,
  browserName: wire.browser_name,
  browserVersion: wire.browser_version,
  backedUp: wire.backed_up,
  backupEligible: wire.backup_eligible,
  transports: wire.transports,
  createdAt: wire.created_at,
  lastUsedAt: wire.last_used_at,
  lastUsedDevice: wire.last_used_device,
  updatedAt: wire.updated_at,
  version: wire.version,
})
