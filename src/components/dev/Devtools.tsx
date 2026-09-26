import { Suspense, lazy } from 'react'

// `import.meta.env.DEV` is a build-time constant, so production builds drop the import
// and the devtools chunk entirely.
const DevtoolsPanel = import.meta.env.DEV
  ? lazy(() => import('./DevtoolsPanel'))
  : null

export function Devtools() {
  if (!DevtoolsPanel) return null
  return (
    <Suspense fallback={null}>
      <DevtoolsPanel />
    </Suspense>
  )
}
