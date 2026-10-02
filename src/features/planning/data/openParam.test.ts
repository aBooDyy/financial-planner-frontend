import { describe, expect, it } from 'vitest'
import { goalsRedirect } from './goalsRedirect'
import { encodePlanningOpen, parsePlanningOpen } from './openParam'

const ID = '0192f0c4-7b1e-7c3a-9d2e-4f5a6b7c8d9e'

describe('Planning ?open=', () => {
  it('reads a bill, goal, income or planned item and round-trips it', () => {
    for (const kind of ['bill', 'goal', 'income', 'planned'] as const) {
      const intent = { kind, id: ID }
      expect(parsePlanningOpen(encodePlanningOpen(intent))).toEqual(intent)
    }
  })

  it('drops anything malformed', () => {
    expect(parsePlanningOpen(undefined)).toBeNull()
    expect(parsePlanningOpen(`tx:${ID}`)).toBeNull()
    expect(parsePlanningOpen('goal:nope')).toBeNull()
  })
})

describe('old /goals links', () => {
  it('land on the matching Planning section', () => {
    expect(goalsRedirect('summary', undefined)).toEqual({ section: 'overview' })
    expect(goalsRedirect('obligations', undefined)).toEqual({
      section: 'bills',
    })
    expect(goalsRedirect('timeline', undefined)).toEqual({
      section: 'upcoming',
    })
    expect(goalsRedirect('nonsense', undefined)).toEqual({
      section: 'overview',
    })
  })

  it('turn ?goal=<id> into opening that goal', () => {
    expect(goalsRedirect(undefined, ID)).toEqual({
      section: 'goals',
      open: `goal:${ID}`,
    })
  })
})
