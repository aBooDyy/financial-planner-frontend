import { LogOut } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { OfflineNotice } from '#/components/OfflineNotice'
import { useOnline } from '#/hooks/useOnline'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignOut: () => void
}

/**
 * Offline, signing out is refused rather than half-done: the server couldn't end the session,
 * and wiping this device would drop changes that haven't synced yet.
 */
export function SignOutConfirm({ open, onOpenChange, onSignOut }: Props) {
  const online = useOnline()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="neutral"
      icon={<LogOut />}
      title="Sign out?"
      confirmLabel="Sign out"
      confirmVariant="danger-soft"
      confirmDisabled={!online}
      onConfirm={() => {
        onOpenChange(false)
        onSignOut()
      }}
    >
      <p>You'll need to sign in again to see your money on this device.</p>
      {online ? null : (
        <OfflineNotice>
          Signing out needs a connection, so changes you made offline can finish
          syncing first.
        </OfflineNotice>
      )}
    </ConfirmDialog>
  )
}
