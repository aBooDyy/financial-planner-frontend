import { describe, expect, it } from 'vitest'
import type { ConnectionWire } from './types'
import {
  fromWireFrequency,
  toConnection,
  toWireFrequency,
  toWireProvider,
} from './types'

describe('email-sync enum maps', () => {
  it('round-trips scan frequency through the wire', () => {
    for (const f of ['15m', 'hourly', 'daily'] as const) {
      expect(fromWireFrequency(toWireFrequency(f))).toBe(f)
    }
  })

  it('maps providers to their UPPER_SNAKE wire names', () => {
    expect(toWireProvider('google')).toBe('GOOGLE')
    expect(toWireProvider('outlook')).toBe('OUTLOOK')
  })
})

describe('email-sync wire mappers', () => {
  it('maps a connection wire to the domain shape', () => {
    const wire: ConnectionWire = {
      id: 'c1',
      provider: 'GOOGLE',
      email_address: 'khalid@example.com',
      auto_sync: true,
      auto_confirm: false,
      scan_frequency: 'FIFTEEN_MIN',
      default_wallet_id: null,
      status: 'CONNECTED',
      last_synced_at: null,
      rules: [
        {
          id: 'r1',
          sender_email: 'alerts@bank.com',
          sender_name: 'Bank',
          default_category: null,
        },
      ],
      created_at: '2026-06-13T00:00:00Z',
      updated_at: '2026-06-13T00:00:00Z',
      version: 'v1',
    }
    const c = toConnection(wire)
    expect(c.provider).toBe('google')
    expect(c.email).toBe('khalid@example.com')
    expect(c.scanFrequency).toBe('15m')
    expect(c.status).toBe('connected')
    expect(c.rules[0].senderEmail).toBe('alerts@bank.com')
  })
})
