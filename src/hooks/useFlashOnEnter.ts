import { useEffect, useState } from 'react'

/** True for `ms` each time `active` turns on — never for the value it mounts with. */
export function useFlashOnEnter(active: boolean, ms: number): boolean {
  const [was, setWas] = useState(active)
  const [flash, setFlash] = useState(false)
  if (active !== was) {
    setWas(active)
    setFlash(active)
  }

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(false), ms)
    return () => clearTimeout(timer)
  }, [flash, ms])

  return flash
}
