import { Loader2 } from 'lucide-react'

export function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fp-bg text-fp-text-3">
      <Loader2 size={26} className="animate-spin" />
    </div>
  )
}
