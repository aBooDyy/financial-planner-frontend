import { LogOut } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignOut: () => void
}

export function SignOutConfirm({ open, onOpenChange, onSignOut }: Props) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="neutral"
      icon={<LogOut />}
      title="Sign out?"
      confirmLabel="Sign out"
      confirmVariant="danger-soft"
      onConfirm={() => {
        onOpenChange(false)
        onSignOut()
      }}
    >
      <p>You'll need to sign in again to see your money on this device.</p>
    </ConfirmDialog>
  )
}
