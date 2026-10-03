import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')

function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  return css.slice(start, css.indexOf('\n}', start))
}

function token(scope: string, name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(scope)
  if (!match) throw new Error(`--${name} is not a hex colour`)
  return match[1]
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('fill tokens', () => {
  const themes = { light: block(':root'), dark: block('.dark') }

  for (const [theme, scope] of Object.entries(themes)) {
    for (const tone of ['accent', 'warn', 'danger']) {
      it(`reads ${tone} text on its ${theme} fill at 4.5:1 or more`, () => {
        const fill = token(scope, `fp-${tone}-fill`)
        const onFill = token(scope, `fp-on-${tone}-fill`)
        expect(contrast(fill, onFill)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
