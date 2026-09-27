// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

import { UpdatePrompt } from './UpdatePrompt'

const sw = vi.hoisted(() => ({
  options: undefined as RegisterSWOptions | undefined,
  setNeedRefresh: undefined as ((value: boolean) => void) | undefined,
  updateServiceWorker: vi.fn(async () => {}),
}))

vi.mock('virtual:pwa-register/react', async () => {
  const { useState } = await import('react')
  return {
    useRegisterSW: (options: RegisterSWOptions) => {
      sw.options = options
      const needRefresh = useState(false)
      sw.setNeedRefresh = needRefresh[1]
      return {
        needRefresh,
        offlineReady: useState(false),
        updateServiceWorker: sw.updateServiceWorker,
      }
    },
  }
})

const watch = vi.hoisted(() => ({ stop: vi.fn(), start: vi.fn() }))
vi.mock('../watchForUpdates', () => ({
  watchForUpdates: (registration: ServiceWorkerRegistration) => {
    watch.start(registration)
    return watch.stop
  },
}))

const reload = vi.fn()

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, reload })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const newVersionArrives = () => act(() => sw.setNeedRefresh?.(true))
const prompt = () => screen.queryByText('New version available')

describe('UpdatePrompt', () => {
  it('stays hidden until a new version is waiting', () => {
    render(<UpdatePrompt />)
    expect(prompt()).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()

    newVersionArrives()
    expect(prompt()).not.toBeNull()
  })

  it('activates the waiting worker on Reload, then reloads once it takes control', () => {
    render(<UpdatePrompt />)
    newVersionArrives()

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(sw.updateServiceWorker).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()

    act(() => sw.options?.onNeedReload?.())
    expect(reload).toHaveBeenCalledOnce()
  })

  it('hides on Not now without touching the worker', () => {
    render(<UpdatePrompt />)
    newVersionArrives()

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(prompt()).toBeNull()
    expect(sw.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('never reloads by itself when another tab took the update', () => {
    render(<UpdatePrompt />)

    act(() => sw.options?.onNeedReload?.())
    expect(reload).not.toHaveBeenCalled()
    expect(prompt()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledOnce()
    expect(sw.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('watches for updates once registered and stops on unmount', () => {
    const { unmount } = render(<UpdatePrompt />)
    const registration = {} as ServiceWorkerRegistration

    act(() => sw.options?.onRegisteredSW?.('/sw.js', registration))
    expect(watch.start).toHaveBeenCalledWith(registration)

    unmount()
    expect(watch.stop).toHaveBeenCalledOnce()
  })
})
