import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '#/lib/utils'

type Props = {
  id: string
  terms: string[]
  onChange: (terms: string[]) => void
  max: number
  placeholder: string
  /** Addresses read left to right whatever the page direction. */
  ltr?: boolean
  invalid?: boolean
  describedBy?: string
}

/**
 * A short list of words or addresses as chips. Enter or a comma adds what is typed; Backspace
 * in an empty box takes the last one back.
 */
export function TermsInput({
  id,
  terms,
  onChange,
  max,
  placeholder,
  ltr = false,
  invalid,
  describedBy,
}: Props) {
  const [text, setText] = useState('')
  const full = terms.length >= max

  const commit = () => {
    const term = text.trim()
    if (!term || full) return
    onChange([...terms, term])
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && text === '' && terms.length > 0) {
      onChange(terms.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1.5 rounded-[14px] border-[1.5px] bg-fp-surface-2 px-[10px] py-2 transition focus-within:border-fp-accent focus-within:ring-[3px] focus-within:ring-fp-accent/15',
        invalid ? 'border-fp-danger bg-fp-danger/[0.07]' : 'border-fp-border',
      )}
    >
      {terms.length > 0 ? (
        <ul role="list" className="contents">
          {terms.map((term, index) => (
            <li
              key={`${term}-${index}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border-[1.5px] border-fp-border bg-fp-surface py-[3px] ps-[11px] pe-1 text-[12.5px] font-semibold"
            >
              <bdi dir={ltr ? 'ltr' : 'auto'} className="truncate">
                {term}
              </bdi>
              <button
                type="button"
                aria-label={`Remove ${term}`}
                onClick={() => onChange(terms.filter((_, i) => i !== index))}
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text"
              >
                <X size={12} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        dir={ltr ? 'ltr' : undefined}
        value={text}
        disabled={full}
        placeholder={
          full ? `Up to ${max}` : terms.length > 0 ? 'Add another' : placeholder
        }
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        className="min-w-[110px] flex-1 bg-transparent px-1 py-1 text-[13px] font-semibold text-fp-text outline-none placeholder:font-medium placeholder:text-fp-text-3 disabled:cursor-not-allowed"
      />
    </div>
  )
}
