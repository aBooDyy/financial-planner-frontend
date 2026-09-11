export type PasswordStrength = { score: number; label: string }

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']

/** Lightweight 0–4 heuristic that drives the signup strength meter. Not a security gate. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '' }

  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1

  const clamped = Math.min(score, 4)
  return { score: clamped, label: LABELS[clamped] }
}
