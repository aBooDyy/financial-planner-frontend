import { ScanFace } from 'lucide-react'
import { Button } from '#/components/Button'
import { useOnline } from '#/hooks/useOnline'
import { useGoogleAuth } from '../hooks/useGoogleAuth'
import { FormError } from './FormError'

// Passkey / Face ID sign-in is presentational for now — no WebAuthn backend yet.
const notYetAvailable = () => {}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.8H1.8v3C3.7 21.4 7.6 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.6a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.4l3.8 3C6.5 6.8 9 4.8 12 4.8z"
      />
    </svg>
  )
}

type Props = { showPasskey?: boolean }

export function SocialAuthButtons({ showPasskey = false }: Props) {
  const google = useGoogleAuth()
  const online = useOnline()

  return (
    <div className="flex flex-col gap-2.5">
      <Button
        variant="secondary"
        onClick={google.start}
        disabled={google.pending || !online}
      >
        <GoogleIcon />
        {google.pending ? 'Connecting…' : 'Continue with Google'}
      </Button>
      {google.error ? <FormError message={google.error} /> : null}
      {showPasskey ? (
        <Button
          variant="secondary"
          className="lg:hidden"
          onClick={notYetAvailable}
        >
          <ScanFace
            size={19}
            strokeWidth={1.8}
            className="text-fp-accent-ink"
          />
          Sign in with Face ID
        </Button>
      ) : null}
    </div>
  )
}
