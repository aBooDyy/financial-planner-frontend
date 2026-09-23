import { Link } from '@tanstack/react-router'
import { ArrowRight, Mail } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ScanNowControl } from '#/features/email-sync/components/ScanNowControl'
import { useInboxSummary } from '#/features/import/hooks/useInboxSummary'
import { ImportSourceCard } from './ImportSourceCard'

export function InboxSourceCard() {
  const { loading, connections, pendingCount } = useInboxSummary()
  const connected = connections.length > 0
  const many = connections.length > 1

  return (
    <ImportSourceCard
      icon={Mail}
      title="From your inbox"
      footer={
        connected ? (
          <>
            {pendingCount > 0 ? (
              <Button asChild className="px-[15px] py-[10px] text-[13.5px]">
                <Link to="/transactions" search={{ review: true }}>
                  Review {pendingCount}
                  <ArrowRight size={15} strokeWidth={2} />
                </Link>
              </Button>
            ) : null}
            <Button
              asChild
              variant="outline"
              className="px-[14px] py-[9px] text-[13px]"
            >
              <Link to="/settings/email-sync">Manage inbox</Link>
            </Button>
          </>
        ) : (
          <Button asChild className="px-[15px] py-[10px] text-[13.5px]">
            <Link to="/settings/email-sync">
              Connect an inbox
              <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </Button>
        )
      }
    >
      {loading ? <span>Checking your connected inboxes…</span> : null}

      {!loading && !connected ? (
        <span>
          Connect the inbox where your bank and card alerts land. Means reads
          them read-only and logs each transaction for you.
        </span>
      ) : null}

      {connections.map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
        >
          <span className="min-w-0 truncate">
            <span className="font-semibold text-fp-text">{c.email}</span> ·{' '}
            {c.lastScanned}
          </span>
          {many ? <ScanNowControl compact connectionId={c.id} /> : null}
        </div>
      ))}

      {connected ? (
        <span>
          {pendingCount > 0
            ? `${pendingCount} waiting for review`
            : 'Nothing waiting for review'}
        </span>
      ) : null}

      {connected ? (
        <ScanNowControl
          className="mt-1.5"
          connectionId={many ? undefined : connections[0].id}
          label={many ? 'Scan all' : 'Scan now'}
        />
      ) : null}
    </ImportSourceCard>
  )
}
