import { useEffect, useState } from 'react'

/** Reactively tracks a CSS media query. SPA-only (no SSR guard needed). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** True at the `md` breakpoint and up (desktop). Mobile renders the bottom-sheet chrome. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
