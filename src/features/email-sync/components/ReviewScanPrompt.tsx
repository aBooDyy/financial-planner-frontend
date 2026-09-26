import { ScanNowControl } from './ScanNowControl'

/** The inbox's offer inside the review queue: sync for more without leaving it. */
export function ReviewScanPrompt() {
  return (
    <>
      <span className="text-[12.5px] text-fp-text-3">
        Expecting more? Sync your inboxes without leaving.
      </span>
      <ScanNowControl compact />
    </>
  )
}
