import { EXTERNAL } from '#/features/goals/hooks/useContributionForm'
import type { ContributionForm } from '#/features/goals/hooks/useContributionForm'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { TextField } from '#/components/TextField'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { usePreferencesStore } from '#/stores/preferences'
import { WalletDot } from '../WalletDot'

const NONE = '__none__'

/** 1b's source and date, plus where external money is held. */
export function ContributionFields({ f }: { f: ContributionForm }) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  return (
    <>
      <div className="grid grid-cols-[1.3fr_1fr] items-start gap-3">
        <div className="min-w-0">
          <FieldLabel>From</FieldLabel>
          <Select
            value={f.source || NONE}
            onValueChange={(v) => f.setSource(v === NONE ? '' : v)}
          >
            <SelectTrigger aria-label="From">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.mode === 'later' || f.wallets.length === 0 ? (
                <SelectItem value={NONE}>
                  {f.wallets.length === 0 ? 'No wallets yet' : 'Decide later'}
                </SelectItem>
              ) : null}
              {f.wallets.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  <WalletDot color={w.color} />
                  {w.name}
                </SelectItem>
              ))}
              {f.allowExternal ? (
                <SelectItem value={EXTERNAL}>External…</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <FieldLabel>Date</FieldLabel>
          <DateField
            value={f.date}
            onChange={f.setDate}
            dateFormat={dateFormat}
            ariaLabel="Date"
          />
        </div>
      </div>

      {f.isExternal ? (
        <TextField
          id="contribution-external"
          label="Held where?"
          value={f.externalLabel}
          onChange={(e) => f.setExternalLabel(e.target.value)}
          placeholder="e.g. Dad's help, cash at home"
        />
      ) : null}
    </>
  )
}
