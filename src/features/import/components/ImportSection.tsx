import { Link } from '@tanstack/react-router'
import { FileUp } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { SectionHeader } from '#/features/settings/components/SectionHeader'
import { ImportHistoryCard } from './ImportHistoryCard'
import { ImportSourceCard } from './ImportSourceCard'
import { ImportTemplatesCard } from './ImportTemplatesCard'
import { InboxSourceCard } from './InboxSourceCard'

/** The Settings pane every import starts from: the two sources, past batches, saved mappings. */
export function ImportSection() {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Import"
        subtitle="Bring transactions in from your inbox or from a file."
      />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <InboxSourceCard />

        <ImportSourceCard
          icon={FileUp}
          title="From a file"
          footer={
            <Button asChild className="px-[15px] py-[10px] text-[13.5px]">
              <Link to="/import">Choose a file</Link>
            </Button>
          }
        >
          <span>Upload a CSV exported from your bank or another app.</span>
          <span>Nothing is uploaded — the file is read on this device.</span>
        </ImportSourceCard>
      </div>

      <ImportHistoryCard />

      <ImportTemplatesCard />
    </div>
  )
}
