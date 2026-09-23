import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import { messageForCode } from '#/lib/errorMessages'
import type { Dialect } from '#/features/import/data/types'
import type {
  ImportFileInfo,
  ReadState,
} from '#/features/import/hooks/useCsvImport'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: ImportFileInfo
  read: ReadState
  onChange: (patch: Partial<Dialect>) => void
}

const DELIMITERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: ',', label: 'Comma  ,' },
  { value: ';', label: 'Semicolon  ;' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe  |' },
]

const ENCODINGS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'windows-1256', label: 'Arabic (windows-1256)' },
  { value: 'windows-1252', label: 'Western (windows-1252)' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
]

const LABEL = 'mb-[5px] block text-[11.5px] font-semibold text-fp-text-2'
const PREVIEW_ROWS = 5

const cellText = (value: string | undefined): string =>
  value === undefined || value.trim() === '' ? '—' : value

/**
 * The four detected choices, over the parse they produce. Every change re-reads the file,
 * so the preview below is the real result rather than a guess about it.
 */
export function DialectDialog({
  open,
  onOpenChange,
  file,
  read,
  onChange,
}: Props) {
  const { dialect } = file
  const preview = file.sample.slice(0, PREVIEW_ROWS)
  const columns = Math.max(file.headers.length, file.columnCount)

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Adjust how this file is read"
      description="Detection is a proposal — change anything that looks wrong."
      contentClassName="sm:max-w-[640px]"
      footer={
        <Button
          type="button"
          className="ms-auto px-[17px] py-[10px] text-[13.5px]"
          onClick={() => onOpenChange(false)}
        >
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {read.status === 'failed' ? (
          <Alert variant="destructive">
            <AlertDescription>
              {messageForCode(read.code)} The previous reading is still shown
              below.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className={LABEL} htmlFor="csv-delimiter">
              Separator
            </Label>
            <Select
              value={dialect.delimiter}
              onValueChange={(delimiter) => onChange({ delimiter })}
            >
              <SelectTrigger id="csv-delimiter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIMITERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className={LABEL} htmlFor="csv-encoding">
              Encoding
            </Label>
            <Select
              value={dialect.encoding}
              onValueChange={(encoding) => onChange({ encoding })}
            >
              <SelectTrigger id="csv-encoding">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENCODINGS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className={LABEL} htmlFor="csv-decimal">
              Decimal separator
            </Label>
            <Select
              value={dialect.decimal}
              onValueChange={(value) =>
                onChange({ decimal: value === ',' ? ',' : '.' })
              }
            >
              <SelectTrigger id="csv-decimal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=".">1,234.56 — dot</SelectItem>
                <SelectItem value=",">1.234,56 — comma</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className={LABEL} htmlFor="csv-skip-rows">
              Lines to skip above the header
            </Label>
            <Input
              id="csv-skip-rows"
              type="number"
              min={0}
              max={50}
              inputMode="numeric"
              className="tabular-nums"
              value={dialect.skipRows}
              onChange={(event) => {
                const skipRows = Number(event.target.value)
                if (Number.isFinite(skipRows) && skipRows >= 0) {
                  onChange({ skipRows })
                }
              }}
            />
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-fp-border bg-fp-surface-2 px-[13px] py-[11px] text-[13px]">
          <span className="font-semibold">The first row is a header</span>
          <Switch
            checked={dialect.hasHeader}
            onCheckedChange={(hasHeader) => onChange({ hasHeader })}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-fp-text-2">
              First {preview.length} rows
            </span>
            {read.status === 'reading' ? (
              <span aria-live="polite" className="text-[11.5px] text-fp-text-3">
                Re-reading…
              </span>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-xl border border-fp-border">
            <table className="w-full border-collapse text-[12px]">
              {file.headers.length > 0 ? (
                <thead>
                  <tr className="bg-fp-surface-2">
                    {Array.from({ length: columns }, (_, column) => (
                      <th
                        key={column}
                        className="border-b border-fp-border px-2.5 py-2 text-start font-bold whitespace-nowrap"
                      >
                        {cellText(file.headers[column])}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {preview.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-fp-border last:border-0"
                  >
                    {Array.from({ length: columns }, (_, column) => (
                      <td
                        key={column}
                        className="px-2.5 py-2 text-start whitespace-nowrap text-fp-text-2"
                      >
                        {cellText(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
