import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import { readSample } from './payloadTree'

export type DeliveryTone = 'ok' | 'warn' | 'error' | 'idle'

/** What happened to one delivery, in a headline and — when there is something to do — why. */
export type DeliverySummary = {
  tone: DeliveryTone
  headline: string
  help?: string
}

type Limits = { rateLimitPerMinute: number; payloadMaxBytes: number }

const REFUSED: Record<string, (limits: Limits) => DeliverySummary> = {
  'integrations.auth.invalid': () => ({
    tone: 'error',
    headline: 'Refused — wrong secret',
    help: 'It started like this key, but the rest of the key didn’t match. Copy the key into your app again — if you no longer have it, rotate the key for a new one.',
  }),
  'integrations.auth.revoked': () => ({
    tone: 'error',
    headline: 'Refused — key revoked',
    help: 'This key no longer accepts transactions. Rotate it to use it again.',
  }),
  'integrations.auth.expired': () => ({
    tone: 'error',
    headline: 'Refused — key expired',
    help: 'Choose a later expiry date for this key to use it again.',
  }),
  'integrations.rate.limited': ({ rateLimitPerMinute }) => ({
    tone: 'error',
    headline: 'Refused — over the rate limit',
    help: `More than ${rateLimitPerMinute} requests arrived within a minute. The rest of that minute’s requests were refused too and aren’t listed.`,
  }),
  'integrations.payload.too_large': ({ payloadMaxBytes }) => ({
    tone: 'error',
    headline: 'Refused — too large',
    help: `The body was over the ${Math.round(payloadMaxBytes / 1024)} KB a webhook can send.`,
  }),
  'integrations.payload.invalid': () => ({
    tone: 'error',
    headline: 'Refused — not a JSON object',
    help: 'Means reads a JSON object — the body has to start with {.',
  }),
  'common.internal': () => ({
    tone: 'error',
    headline: 'Failed on our side',
    help: 'Something went wrong in Means while handling this. Sending it again should work.',
  }),
}

export function summarizeDelivery(
  delivery: Delivery,
  limits: Limits,
): DeliverySummary {
  const missing = delivery.report?.result.missing.length ?? 0
  switch (delivery.outcome) {
    case 'POSTED':
      return { tone: 'ok', headline: 'Added to your ledger' }
    case 'STAGED':
      if (delivery.ruleId === null) {
        return {
          tone: 'warn',
          headline: 'No rule matched — waiting for review',
        }
      }
      return missing > 0
        ? {
            tone: 'warn',
            headline: 'Waiting for review — some fields weren’t found',
          }
        : { tone: 'ok', headline: 'Waiting for review' }
    case 'DUPLICATE':
      return {
        tone: 'idle',
        headline: 'Already received — nothing new added',
      }
    case 'IGNORED':
      return { tone: 'warn', headline: 'No rule matched — nothing kept' }
    case 'SKIPPED':
      return {
        tone: 'idle',
        headline: 'Skipped — you marked one like it as not a transaction',
      }
    case 'REJECTED': {
      const refused = delivery.errorCode ? REFUSED[delivery.errorCode] : null
      return refused ? refused(limits) : { tone: 'error', headline: 'Refused' }
    }
  }
}

export const DELIVERY_TONE_TEXT: Record<DeliveryTone, string> = {
  ok: 'text-fp-accent-ink',
  warn: 'text-fp-warn',
  error: 'text-fp-danger',
  idle: 'text-fp-text-3',
}

/** Whether "build a rule from this" can find a JSON object to build from. */
export const canBuildFrom = (delivery: Delivery): boolean =>
  delivery.importId !== null ||
  (delivery.payloadExcerpt !== null &&
    readSample(delivery.payloadExcerpt, Number.POSITIVE_INFINITY).ok)
