import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '#/components/ui/alert'

export function FormError({ message }: { message: string }) {
  return (
    <Alert
      variant="destructive"
      className="items-center rounded-xl border-fp-danger/30 bg-fp-danger/10 px-3.5 py-2.5 text-fp-danger"
    >
      <AlertCircle size={16} strokeWidth={2} />
      <AlertDescription className="text-[13px] font-medium text-fp-danger">
        {message}
      </AlertDescription>
    </Alert>
  )
}
