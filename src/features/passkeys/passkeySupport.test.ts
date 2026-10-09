import { describe, expect, it } from 'vitest'
import { platformLabel, setUpLabel, signInLabel } from './passkeySupport'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

describe('platformLabel', () => {
  it.each([
    ['an iPhone', IPHONE, 0, 'Face ID'],
    ['an iPad, which reports a Mac user agent', MAC, 5, 'Face ID'],
    ['a Mac', MAC, 0, 'Touch ID'],
    ['Windows', WINDOWS, 0, 'a passkey'],
    ['Android', ANDROID, 5, 'a passkey'],
  ])('names %s', (_name, userAgent, maxTouchPoints, label) => {
    expect(platformLabel({ userAgent, maxTouchPoints })).toBe(label)
  })

  it('words the buttons around the label', () => {
    expect(signInLabel('Face ID')).toBe('Sign in with Face ID')
    expect(signInLabel('a passkey')).toBe('Sign in with a passkey')
    expect(setUpLabel('Touch ID')).toBe('Set up Touch ID')
  })
})
