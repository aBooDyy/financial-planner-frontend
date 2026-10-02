export type MoneyActionCode =
  | 'not_found'
  | 'closed'
  | 'no_wallet'
  | 'bad_amount'
  | 'category_required'
  | 'no_next_occurrence'
  | 'signed_out'

/** A money action the item's state does not allow. `code` is stable; show your own copy. */
export class MoneyActionError extends Error {
  readonly code: MoneyActionCode
  constructor(code: MoneyActionCode) {
    super(`planning.${code}`)
    this.code = code
  }
}
