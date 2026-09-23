import { ScanNowControl } from './ScanNowControl'

/** The inbox's offer inside the review queue: scan for more without leaving it. */
export function ReviewScanPrompt() {
  return (
    <>
      <span className="text-[12.5px] text-fp-text-3">
        Expecting more? Pull the last 30 days without leaving.
      </span>
      <ScanNowControl compact />
    </>
  )
}
