import { useAppUpdate } from '../hooks/useAppUpdate'
import { UpdateToast } from './UpdateToast'

/** Mounted once in the root layout: owns the service worker and offers each new release. */
export function UpdatePrompt() {
  const { updateReady, reload, dismiss } = useAppUpdate()
  return (
    <UpdateToast open={updateReady} onReload={reload} onDismiss={dismiss} />
  )
}
