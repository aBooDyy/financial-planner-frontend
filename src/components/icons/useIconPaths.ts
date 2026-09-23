import { useEffect, useState } from 'react'
import { loadIconPaths } from '#/lib/icons/paths'
import type { IconPaths } from '#/lib/icons/paths'

// Held outside React so a mount after the chunk has landed paints its path on the first
// render — a placeholder that flashed on every row would defeat the point of having one.
let resolved: IconPaths | null = null

/** The path table once its chunk is in, `null` while it is still in flight. */
export function useIconPaths(): IconPaths | null {
  const [paths, setPaths] = useState(resolved)

  useEffect(() => {
    if (paths) return
    let alive = true
    void loadIconPaths().then((loaded) => {
      resolved = loaded
      if (alive) setPaths(loaded)
    })
    return () => {
      alive = false
    }
  }, [paths])

  return paths
}
