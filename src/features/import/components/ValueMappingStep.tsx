import { useCallback, useState } from 'react'
import { Button } from '#/components/ui/button'
import { SKIP } from '#/features/import/data/values'
import { useValueMapping } from '#/features/import/hooks/useValueMapping'
import { CreateCategoryDialog } from './CreateCategoryDialog'
import { CreateMerchantDialog } from './CreateMerchantDialog'
import { CreateWalletDialog } from './CreateWalletDialog'
import { TemplateSaveField } from './TemplateSaveField'
import { ValueMatchGroup } from './ValueMatchGroup'
import { ValueMissingCard } from './ValueMissingCard'
import { WizardFooter } from './WizardFooter'
import type { ReactNode } from 'react'
import type { MappingDraft } from '#/features/import/data/mapping'
import type { CsvImport } from '#/features/import/hooks/useCsvImport'
import type { TemplateSave } from '#/features/import/hooks/useTemplateSave'
import type { ValueGroup, ValueKind } from '#/features/import/data/values'

type Props = {
  csv: CsvImport
  draft: MappingDraft
  /** The footer's save choice. Absent only where a test drives the step on its own. */
  save?: TemplateSave
  onBack: () => void
  onNext: () => void
}

type Creating = { kind: ValueKind; key: string; raw: string }

const CREATE_LABELS: Partial<Record<ValueKind, string>> = {
  wallet: 'Create an account…',
  category: 'Create a category…',
  merchant: 'Create a merchant…',
}

const SKIP_LABELS: Partial<Record<ValueKind, string>> = {
  wallet: 'Skip these rows',
  category: 'Use the default category',
  merchant: 'Leave it in the note',
}

function GroupAction({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="px-[10px] py-[6px] text-[12px]"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/** Step ③: what the file's own words mean here. */
export function ValueMappingStep({ csv, draft, save, onBack, onNext }: Props) {
  const values = useValueMapping(csv, draft)
  const [creating, setCreating] = useState<Creating | null>(null)

  /**
   * Slugs are unique among siblings only (a child named "Other" may sit under two parents),
   * so what is taken depends on where the new category is going — including the creates
   * this import has already recorded but not yet written.
   */
  const takenSlugs = useCallback(
    (parentId: string | null): ReadonlyArray<string> => {
      const parent = parentId
        ? (csv.catalog.all.find((c) => c.id === parentId) ?? null)
        : null
      const existing = parent
        ? parent.subs.map((sub) => sub.slug)
        : csv.catalog.all.map((category) => category.slug)
      const pending = Object.values(draft.aliases.categories)
        .filter((target) => target.kind === 'create')
        .filter((target) => (target.parentId ?? null) === parentId)
        .map((target) => target.subcategory ?? target.category)
      return [...new Set([...existing, ...pending])]
    },
    [csv.catalog, draft.aliases.categories],
  )

  // Stable, so the memo on every row of every group keeps biting when one answer changes.
  const create = useCallback(
    (kind: ValueKind, key: string, raw: string) =>
      setCreating({ kind, key, raw }),
    [],
  )

  const defaultLabelFor = (kind: ValueKind): string | null => {
    if (kind === 'wallet') return values.defaults.wallet ?? 'no account'
    if (kind === 'category') return values.defaults.category
    if (kind === 'currency') return draft.defaults.currency
    if (kind === 'type')
      return draft.defaults.type === 'spend' ? 'money out' : 'money in'
    return null
  }

  /**
   * A group's bulk answers. The ones that settle what is left over only appear while
   * something is left over, so the header never offers a button with nothing to do.
   */
  const actionFor = (group: ValueGroup) => {
    const leftover = group.found - group.matched
    if (group.kind === 'wallet') {
      return leftover > 0 ? (
        <GroupAction onClick={() => values.fillUnmatched('wallet', SKIP)}>
          Skip the unmatched rows
        </GroupAction>
      ) : undefined
    }
    if (group.kind === 'category') {
      return (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {leftover > 0 ? (
            <GroupAction onClick={() => values.fillUnmatched('category', SKIP)}>
              {`Use ${values.defaults.category} for the rest`}
            </GroupAction>
          ) : null}
          <GroupAction onClick={() => values.autoMatchAgain('category')}>
            Auto-match again
          </GroupAction>
        </div>
      )
    }
    if (group.kind === 'merchant') {
      return (
        <GroupAction
          onClick={() => values.setMerchantsSkipped(!values.merchantsSkipped)}
        >
          {values.merchantsSkipped
            ? 'Match merchants again'
            : 'Skip merchants for this import'}
        </GroupAction>
      )
    }
    return undefined
  }

  return (
    <>
      {values.groups.length === 0 && values.notices.length === 0 ? (
        <section className="rounded-2xl border border-fp-border bg-fp-surface p-[18px] text-[13px] text-fp-text-2 shadow-fp">
          This file names no accounts, categories or merchants of its own, so
          there is nothing to match. Every row uses the defaults you set in the
          previous step.
        </section>
      ) : null}

      {values.notices.map((notice) => (
        <ValueMissingCard key={notice.kind} notice={notice} />
      ))}

      {values.groups.map((group) => (
        <ValueMatchGroup
          key={group.kind}
          group={group}
          action={actionFor(group)}
          createLabel={CREATE_LABELS[group.kind] ?? null}
          skipLabel={SKIP_LABELS[group.kind] ?? null}
          baseCurrency={csv.baseCurrency}
          defaultLabel={defaultLabelFor(group.kind)}
          onChange={values.setValue}
          onCreate={create}
        />
      ))}

      <p className="text-[12px] text-fp-text-3">
        Binding a spelling to a merchant teaches it for next time — from a file
        or from a bank alert. Nothing is written until you import.
      </p>

      {save ? <TemplateSaveField save={save} /> : null}

      <WizardFooter
        onBack={onBack}
        nextLabel="Next: review"
        onNext={onNext}
        disabled={!values.readiness.ready}
        reason={values.readiness.reason}
      />

      <CreateWalletDialog
        open={creating?.kind === 'wallet'}
        onOpenChange={(open) => {
          if (!open) setCreating(null)
        }}
        raw={creating?.raw ?? ''}
        baseCurrency={csv.baseCurrency}
        onCreate={(target) => {
          if (creating) values.createWallet(creating.key, target)
        }}
      />

      <CreateCategoryDialog
        open={creating?.kind === 'category'}
        onOpenChange={(open) => {
          if (!open) setCreating(null)
        }}
        raw={creating?.raw ?? ''}
        parents={csv.catalog.all}
        takenSlugs={takenSlugs}
        onCreate={(target) => {
          if (creating) values.createCategory(creating.key, target)
        }}
      />

      <CreateMerchantDialog
        open={creating?.kind === 'merchant'}
        onOpenChange={(open) => {
          if (!open) setCreating(null)
        }}
        raw={creating?.raw ?? ''}
        onCreate={(target) => {
          if (creating) values.createMerchant(creating.key, target)
        }}
      />
    </>
  )
}
