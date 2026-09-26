import { KeyRound } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { Button } from '#/components/ui/button'

/** Naming a key is the one field people stall on, so the examples name it for them. */
const EXAMPLES = ['Tasker', 'n8n', 'Shortcuts']

type Props = {
  canCreate: boolean
  onCreate: (name?: string) => void
}

export function NoKeysCard({ canCreate, onCreate }: Props) {
  return (
    <EmptyState
      icon={KeyRound}
      framed
      title="No keys yet"
      text="Create one, paste it into the app that should log your transactions, and tell Means where to find the amount in what it sends."
      action={{
        label: 'New key',
        onClick: () => onCreate(),
        disabled: !canCreate,
      }}
    >
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
    </EmptyState>
  )
}
