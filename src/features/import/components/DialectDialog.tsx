import { CircleAlert } from 'lucide-react'
import { Chip, ChipRow } from '#/components/dialog/Chip'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { FieldLabel } from '#/components/FieldLabel'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
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

const DELIMITERS: ReadonlyArray<{
  value: string
  label: string
  glyph?: string
}> = [
  { value: ',', label: 'Comma', glyph: ',' },
  { value: ';', label: 'Semicolon', glyph: ';' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe', glyph: '|' },
]

const DECIMALS = [
  { value: '.', label: '1,234.56' },
  { value: ',', label: '1.234,56' },
] as const

const ENCODINGS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'windows-1256', label: 'Arabic (windows-1256)' },
  { value: 'windows-1252', label: 'Western (windows-1252)' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
]

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
        <DialogActions
          submitLabel="Done"
          onSubmit={() => onOpenChange(false)}
        />
      }
    >
      {read.status === 'failed' ? (
        <NoteBox tone="danger" icon={<CircleAlert />}>
          {messageForCode(read.code)} The previous reading is still shown below.
        </NoteBox>
      ) : null}

      <div>
        <FieldLabel>What separates the columns?</FieldLabel>
        <ChipRow label="Separator">
          {DELIMITERS.map((option) => (
            <Chip
              key={option.value}
              active={dialect.delimiter === option.value}
              onClick={() => onChange({ delimiter: option.value })}
            >
              {option.label}
              {option.glyph ? (
                <span aria-hidden className="font-mono text-fp-text-3">
                  {option.glyph}
                </span>
              ) : null}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <div>
        <FieldLabel>How are decimals written?</FieldLabel>
        <PillSwitch<Dialect['decimal']>
          label="Decimal separator"
          options={DECIMALS}
          value={dialect.decimal}
          onChange={(decimal) => onChange({ decimal })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <FieldLabel htmlFor="csv-encoding">Encoding</FieldLabel>
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

        <div className="min-w-0">
          <FieldLabel htmlFor="csv-skip-rows">
            Lines to skip above the header
          </FieldLabel>
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

      <ToggleCard
        title="The first row is a header"
        description="Its cells name the columns instead of being imported."
        checked={dialect.hasHeader}
        onCheckedChange={(hasHeader) => onChange({ hasHeader })}
      />

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[13px] font-bold text-fp-text-2">
            First {preview.length} rows
          </span>
          {read.status === 'reading' ? (
            <span
              aria-live="polite"
              className="text-[12px] font-semibold text-fp-text-3"
            >
              Re-reading…
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-fp-border">
          <table className="w-full border-collapse text-[12.5px]">
            {file.headers.length > 0 ? (
              <thead>
                <tr className="bg-fp-surface-2">
                  {Array.from({ length: columns }, (_, column) => (
                    <th
                      key={column}
                      className="border-b border-fp-border px-3 py-2 text-start font-bold whitespace-nowrap text-fp-text"
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
                      className="px-3 py-2 text-start whitespace-nowrap text-fp-text-2"
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
    </ResponsiveDialog>
  )
}
