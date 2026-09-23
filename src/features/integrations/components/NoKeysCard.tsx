import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'

/** Naming a key is the one field people stall on, so the examples name it for them. */
const EXAMPLES = ['Tasker', 'n8n', 'Shortcuts']

type Props = {
  canCreate: boolean
  onCreate: (name?: string) => void
}

export function NoKeysCard({ canCreate, onCreate }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-fp-border-strong bg-fp-surface px-6 py-8 text-center">
      <p className="max-w-[440px] text-[13.5px] leading-relaxed text-fp-text-2">
        No keys yet. Create one, paste it into the app that should log your
        transactions, and tell Means where to find the amount in what it sends.
      </p>
      <Button
        type="button"
        disabled={!canCreate}
        onClick={() => onCreate()}
        className="gap-1.5 px-4 py-[10px] text-[13.5px]"
      >
        <Plus size={15} strokeWidth={2.2} />
        New key
      </Button>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((name) => (
          <Button
            key={name}
            type="button"
            variant="outline"
            disabled={!canCreate}
            onClick={() => onCreate(name)}
            className="rounded-full bg-fp-surface-2 px-3 py-1.5 text-[12.5px] font-semibold"
          >
            {name}
          </Button>
        ))}
      </div>
    </div>
  )
}
