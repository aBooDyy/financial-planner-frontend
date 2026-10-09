import { describe, expect, it } from 'vitest'
import { TEXT_LINE_MAX, TEXT_LINES_MAX, textLines } from './textLines'

describe('textLines', () => {
  it('splits on any line break and keeps blank lines, like the server', () => {
    expect(textLines('a\r\n\rb\nc\n')).toEqual(['a', '', 'b', 'c', ''])
  })

  it('drops NUL and caps each line and the count', () => {
    expect(textLines('a\u0000b')).toEqual(['ab'])
    expect(textLines('x'.repeat(TEXT_LINE_MAX + 5))[0]).toHaveLength(
      TEXT_LINE_MAX,
    )
    expect(textLines('\n'.repeat(TEXT_LINES_MAX + 5))).toHaveLength(
      TEXT_LINES_MAX,
    )
  })
})
