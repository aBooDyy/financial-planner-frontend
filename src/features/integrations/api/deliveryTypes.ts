import type {
  Extraction,
  ExtractionWire,
  TraceEntry,
  TraceEntryWire,
} from './ruleTypes'
import { toExtraction, toTraceEntry } from './ruleTypes'

/** What the ingest endpoint did with one request. */
type DeliveryOutcome =
  | 'STAGED'
  | 'POSTED'
  | 'DUPLICATE'
  | 'IGNORED'
  | 'REJECTED'

/** How the key's rules read a delivery — the same shapes the rule tester answers with. */
type DeliveryReport = { trace: TraceEntry[]; result: Extraction }

export type Delivery = {
  id: string
  receivedAt: string
  outcome: DeliveryOutcome
  statusCode: number
  /** The error code a rejected request was answered with. */
  errorCode: string | null
  ruleId: string | null
  /** The rule's name when the delivery arrived. */
  ruleName: string | null
  importId: string | null
  /** Null when the request's secret did not verify — nothing it sent is kept. */
  payloadExcerpt: string | null
  /** The excerpt may stop short of the whole payload. */
  payloadTruncated: boolean
  /** Null when the request was refused before its rules ran. */
  report: DeliveryReport | null
}

export type DeliveryWire = {
  id: string
  received_at: string
  outcome: DeliveryOutcome
  status_code: number
  error_code: string | null
  rule_id: string | null
  rule_name: string | null
  import_id: string | null
  payload_excerpt: string | null
  payload_truncated: boolean
  report: { trace: TraceEntryWire[]; result: ExtractionWire } | null
}

export const toDelivery = (w: DeliveryWire): Delivery => ({
  id: w.id,
  receivedAt: w.received_at,
  outcome: w.outcome,
  statusCode: w.status_code,
  errorCode: w.error_code,
  ruleId: w.rule_id,
  ruleName: w.rule_name,
  importId: w.import_id,
  payloadExcerpt: w.payload_excerpt,
  payloadTruncated: w.payload_truncated,
  report: w.report
    ? {
        trace: w.report.trace.map(toTraceEntry),
        result: toExtraction(w.report.result),
      }
    : null,
})
