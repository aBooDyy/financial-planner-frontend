import { LeftoverSheet } from '#/features/planning/components/sheets/LeftoverSheet'
import { useLeftoverPromptStore } from '#/features/transactions/stores/leftoverPrompt'

/**
 * Planning's leftover prompt for a bill payment saved from the transaction dialog or QuickAdd,
 * which close as they save — so it is mounted by the root layout, on whatever page they ran.
 */
export function LeftoverPromptHost() {
  const prompt = useLeftoverPromptStore((s) => s.prompt)
  const dismiss = useLeftoverPromptStore((s) => s.dismiss)
  if (!prompt) return null
  return (
    <LeftoverSheet
      key={`${prompt.report.billId}:${prompt.report.occurrence}`}
      report={prompt.report}
      payingWalletId={prompt.payingWalletId}
      date={prompt.date}
      onClose={dismiss}
    />
  )
}
