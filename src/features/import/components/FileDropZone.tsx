import { useRef, useState } from 'react'
import { FileUp, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { useConfigLimits } from '#/lib/config/appConfig'
import { messageForCode } from '#/lib/errorMessages'
import type { ReadState } from '#/features/import/hooks/useCsvImport'

type Props = {
  read: ReadState
  onFile: (file: File) => void
  onCancel: () => void
}

const ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain'

const megabytes = (bytes: number): string =>
  `${Math.round(bytes / (1024 * 1024))} MB`

const rowsLabel = (rows: number): string =>
  `${new Intl.NumberFormat().format(rows)} rows`

/**
 * Step ①. The file is read by a worker on this device — the line saying so is not
 * decoration: it is the reason a person is willing to drop a bank statement here at all.
 */
export function FileDropZone({ read, onFile, onCancel }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const limits = useConfigLimits()
  const reading = read.status === 'reading'

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <section className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          take(event.dataTransfer.files)
        }}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-10 text-center transition md:py-14 ${
          over
            ? 'border-fp-accent bg-fp-accent-soft'
            : 'border-fp-border bg-fp-surface'
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fp-accent-soft text-fp-accent-ink">
          <FileUp size={24} strokeWidth={1.8} />
        </span>

        <div className="flex flex-col gap-1">
          <h2 className="text-[16.5px] font-extrabold tracking-[-0.01em]">
            Drop a CSV here, or choose a file
          </h2>
          <p className="text-[12.5px] text-fp-text-3">
            .csv, .tsv or .txt · up to {megabytes(limits.importMaxBytes)} ·{' '}
            {rowsLabel(limits.importMaxRows)}
          </p>
        </div>

        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            take(event.target.files)
            event.target.value = ''
          }}
        />

        {reading ? (
          <div className="flex w-full max-w-[320px] flex-col gap-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-fp-surface-2">
              <div
                className="h-full rounded-full bg-fp-accent transition-[width]"
                style={{
                  width:
                    read.total && read.total > 0
                      ? `${Math.min(100, Math.round((read.rows / read.total) * 100))}%`
                      : '35%',
                }}
              />
            </div>
            <p
              aria-live="polite"
              className="text-[12.5px] font-semibold text-fp-text-2"
            >
              Reading {new Intl.NumberFormat().format(read.rows)}
              {read.total
                ? ` of ${new Intl.NumberFormat().format(read.total)}`
                : ''}{' '}
              rows…
            </p>
            <Button
              type="button"
              variant="outline"
              className="px-[14px] py-[9px] text-[13px]"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className="px-[17px] py-[10px] text-[13.5px]"
            onClick={() => input.current?.click()}
          >
            Choose a file
          </Button>
        )}

        <p className="flex items-center gap-1.5 text-[12.5px] text-fp-text-2">
          <ShieldCheck size={14} strokeWidth={1.9} aria-hidden />
          Your file is read on this device and never uploaded.
        </p>
      </div>

      {read.status === 'failed' ? (
        <Alert variant="destructive">
          <AlertDescription>
            {messageForCode(read.code)}
            {read.detail ? (
              <span className="block text-fp-text-3">{read.detail}</span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
