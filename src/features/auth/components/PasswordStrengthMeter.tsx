import type { PasswordStrength } from '../passwordStrength'

export function PasswordStrengthMeter({
  strength,
}: {
  strength: PasswordStrength
}) {
  if (!strength.label) return null

  return (
    <div className="mt-2.5 flex items-center gap-2.5">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`h-1 flex-1 rounded-[3px] ${
              bar <= strength.score ? 'bg-fp-accent' : 'bg-fp-border-strong'
            }`}
          />
        ))}
      </div>
      <span className="text-[11.5px] font-semibold text-fp-accent-ink">
        {strength.label}
      </span>
    </div>
  )
}
