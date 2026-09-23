import type { IconId } from './catalog.gen'

export type IconPaths = Record<IconId, string>

let pending: Promise<IconPaths> | null = null

/** One module-scope promise, so every icon on the page shares a single chunk request. */
export const loadIconPaths = (): Promise<IconPaths> =>
  (pending ??= import('./paths.gen').then((m) => m.PATHS))
