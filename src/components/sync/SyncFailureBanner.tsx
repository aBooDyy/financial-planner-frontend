import type { SyncFailure } from '#/db/types'
import type { SyncFailureText } from '#/lib/syncFailureMessages'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { SyncFailureIcon } from './SyncFailureIcon'

type Props = {
  kind: SyncFailure['kind']
  text: SyncFailureText
  onRetry: () => void
  retrying: boolean
}

/** An editor's lead line when the row it edits did not sync: why, what to do, Retry now. */
export function SyncFailureBanner({ kind, text, onRetry, retrying }: Props) {
  const tone =
    kind === 'unavailable'
      ? 'border-fp-warn/30 bg-fp-warn/10'
      : 'border-fp-danger/30 bg-fp-danger/10'
  return (
    <Alert className={cn('items-start rounded-[14px] px-3 py-[10px]', tone)}>
      <SyncFailureIcon kind={kind} size={16} />
      <AlertTitle className="line-clamp-none text-[13px] font-bold text-fp-text">
        {text.title}
      </AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[12.5px] text-fp-text-2">
        <span className="min-w-0 flex-1 basis-[180px]">{text.hint}</span>
        <Button
          type="button"
          variant="quiet"
          size="xs"
          className="rounded-[8px] px-[10px] text-[12px]"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? 'Retrying…' : 'Retry now'}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
