import { CompletionInput } from '#/components/CompletionInput'
import { noteCompletion } from '#/features/transactions/data/noteSuggestions'
import { NOTE_INPUT } from '#/features/transactions/data/txDialog'
import { useNoteSuggestions } from '#/features/transactions/hooks/useNoteSuggestions'
import type { EditorTxType } from '#/features/transactions/hooks/useTxEditor'

type Props = {
  value: string
  onChange: (note: string) => void
  /** Completions come from past notes on entries of this kind. */
  kind: EditorTxType
  placeholder: string
  maxLength?: number
  className?: string
}

/** The entry's free-text note, offering to finish it as an earlier one read. */
export function TxNoteField({
  value,
  onChange,
  kind,
  placeholder,
  maxLength,
  className,
}: Props) {
  const notes = useNoteSuggestions(kind)
  return (
    <CompletionInput
      value={value}
      onValueChange={onChange}
      completion={noteCompletion(notes, value)}
      maxLength={maxLength}
      aria-label="Note"
      placeholder={placeholder}
      className={className ? `${NOTE_INPUT} ${className}` : NOTE_INPUT}
    />
  )
}
