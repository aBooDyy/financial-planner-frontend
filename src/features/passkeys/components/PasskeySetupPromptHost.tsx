import { usePasskeySetupPrompt } from '#/features/passkeys/hooks/usePasskeySetupPrompt'
import { PasskeySetupPrompt } from './PasskeySetupPrompt'

/** Mounted by the root layout: the offer follows a sign-in to whichever page it lands on. */
export function PasskeySetupPromptHost() {
  const prompt = usePasskeySetupPrompt()
  if (!prompt.open) return null
  return <PasskeySetupPrompt onClose={prompt.dismiss} />
}
