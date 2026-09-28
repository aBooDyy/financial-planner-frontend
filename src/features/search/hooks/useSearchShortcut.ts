import { useEffect } from 'react'
import { useSearchStore } from '#/features/search/stores/search'

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest('input, textarea, select, [contenteditable="true"]') !==
      null)

/** ⌘K / Ctrl+K anywhere, or a bare "/" while not typing into something. */
export function isSearchShortcut(e: KeyboardEvent): boolean {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k')
    return true
  return (
    e.key === '/' &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !isEditable(e.target)
  )
}

const isApplePlatform = () =>
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipad/i.test(navigator.userAgent)

/** The key hint the trigger shows, in the platform's own words. */
export const searchShortcutHint = (): string =>
  isApplePlatform() ? '⌘K' : 'Ctrl K'

/**
 * Opens the search sheet from the keyboard. Stands down while another dialog is open, so a
 * "/" typed over an editor stays in the editor.
 */
export function useSearchShortcut() {
  const openSearch = useSearchStore((s) => s.openSearch)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isSearchShortcut(e)) return
      if (useSearchStore.getState().open) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return
      e.preventDefault()
      openSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSearch])
}
