import { CurrencyPicker } from '#/components/CurrencyPicker'
import { isSupportedCurrency } from '#/lib/currency'
import { POPULAR_CURRENCIES } from '../data/currencies'
import { useOnboardingDraft } from '../stores/onboardingDraft'
import { CurrencyCard } from './CurrencyCard'
import { StepIntro } from './StepIntro'

export function CurrencyStep() {
  const currency = useOnboardingDraft((s) => s.currency)
  const setCurrency = useOnboardingDraft((s) => s.setCurrency)

  const popular = POPULAR_CURRENCIES.filter(isSupportedCurrency)
  // A currency found through search joins the cards, so the pick is always visible.
  const cards = popular.includes(currency) ? popular : [...popular, currency]

  return (
    <>
      <StepIntro
        eyebrow="Base currency"
        title="Which currency do you think in?"
      >
        Totals, budgets and goals will show in this currency. Your wallets can
        still hold others.
      </StepIntro>
      <div
        role="radiogroup"
        aria-label="Base currency"
        className="mt-[26px] grid grid-cols-1 gap-[9px] md:grid-cols-2"
      >
        {cards.map((code) => (
          <CurrencyCard
            key={code}
            code={code}
            on={code === currency}
            onPick={() => setCurrency(code)}
          />
        ))}
      </div>
      <div className="mt-5 max-w-[420px]">
        <div className="mb-2 text-[12.5px] font-semibold text-fp-text-2">
          Not listed? Search every currency
        </div>
        <CurrencyPicker
          value={currency}
          onChange={setCurrency}
          label="Search currencies"
          isoOnly
        />
      </div>
    </>
  )
}
