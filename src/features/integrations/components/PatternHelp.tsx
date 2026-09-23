import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const CONSTRUCTS: { code: string; means: string }[] = [
  { code: '( … )', means: 'the part to keep' },
  { code: String.raw`\d+`, means: 'one or more digits' },
  { code: '.+?', means: 'anything, as little as possible' },
]

/** The three constructs that cover almost every pattern, one tap away and never in the way. */
export function PatternHelp() {
  const [open, setOpen] = useState(false)
  return (
    <div className="text-[12px] text-fp-text-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 font-semibold text-fp-text-2 hover:text-fp-text"
      >
        How patterns work
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={open ? 'rotate-180 transition' : 'transition'}
        />
      </button>
      {open ? (
        <div className="mt-1.5 flex flex-col gap-1">
          <p>
            A pattern reads part of what the path found. Tap one word in the
            payload and Means writes it for you; to write one yourself:
          </p>
          <ul className="flex flex-col gap-0.5">
            {CONSTRUCTS.map((c) => (
              <li key={c.code} className="flex gap-2">
                <code
                  dir="ltr"
                  className="w-12 shrink-0 font-mono text-fp-text"
                >
                  {c.code}
                </code>
                <span>{c.means}</span>
              </li>
            ))}
          </ul>
          <p>
            For example{' '}
            <code dir="ltr" className="font-mono text-fp-text">
              at (.+?) on
            </code>{' '}
            keeps what sits between “at” and “on”.
          </p>
        </div>
      ) : null}
    </div>
  )
}
