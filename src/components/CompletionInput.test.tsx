// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CompletionInput } from './CompletionInput'

afterEach(cleanup)

function Field({
  initial,
  completion,
}: {
  initial: string
  completion: string | null
}) {
  const [value, setValue] = useState(initial)
  return (
    <CompletionInput
      aria-label="Note"
      value={value}
      onValueChange={setValue}
      completion={value === initial ? completion : null}
    />
  )
}

const focusAtEnd = () => {
  const input = screen.getByLabelText<HTMLInputElement>('Note')
  input.focus()
  input.setSelectionRange(input.value.length, input.value.length)
  fireEvent.select(input)
  return input
}

describe('CompletionInput', () => {
  it('shows the completion dimmed once the caret sits at the end', () => {
    render(<Field initial="Cof" completion="fee with Sam" />)
    expect(screen.queryByText('fee with Sam')).toBeNull()
    focusAtEnd()
    expect(screen.getByText('fee with Sam')).toBeTruthy()
  })

  it('takes the completion on Tab', () => {
    render(<Field initial="Cof" completion="fee" />)
    const input = focusAtEnd()
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('Coffee')
  })

  it('takes it on the arrow toward the end', () => {
    render(<Field initial="Cof" completion="fee" />)
    const input = focusAtEnd()
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(input.value).toBe('Coffee')
  })

  it('takes it on a swipe toward the end, not away from it', () => {
    render(<Field initial="Cof" completion="fee" />)
    const input = focusAtEnd()
    fireEvent.touchStart(input, { touches: [{ clientX: 100, clientY: 10 }] })
    fireEvent.touchEnd(input, {
      changedTouches: [{ clientX: 20, clientY: 10 }],
    })
    expect(input.value).toBe('Cof')
    fireEvent.touchStart(input, { touches: [{ clientX: 20, clientY: 10 }] })
    fireEvent.touchEnd(input, {
      changedTouches: [{ clientX: 100, clientY: 12 }],
    })
    expect(input.value).toBe('Coffee')
  })

  it('offers nothing with the caret mid-text', () => {
    render(<Field initial="Cof" completion="fee" />)
    const input = focusAtEnd()
    input.setSelectionRange(1, 1)
    fireEvent.select(input)
    expect(screen.queryByText('fee')).toBeNull()
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('Cof')
  })
})
