import { describe, expect, it } from 'vitest'
import type { LocalTransaction } from '#/db/types'
import { noteCompletion, rankNotes } from './noteSuggestions'

const row = (
  note: string | null,
  date: string,
  type: LocalTransaction['type'] = 'spend',
  deleted = 0,
) => ({ note, date, type, deleted }) as LocalTransaction

describe('rankNotes', () => {
  it('orders notes by use, then by the latest, merging case', () => {
    const rows = [
      row('Coffee with Sam', '2026-09-01'),
      row('coffee beans', '2026-09-20'),
      row('coffee with sam', '2026-09-10'),
      row('Cinema', '2026-09-25'),
    ]
    expect(rankNotes(rows, 'spend')).toEqual([
      'coffee with sam',
      'Cinema',
      'coffee beans',
    ])
  })

  it('keeps to the kind and skips blank and deleted rows', () => {
    const rows = [
      row('Salary', '2026-09-01', 'income'),
      row('ATM', '2026-09-01', 'transfer_out'),
      row('   ', '2026-09-01'),
      row('Gone', '2026-09-01', 'spend', 1),
      row('Groceries', '2026-09-01'),
    ]
    expect(rankNotes(rows, 'spend')).toEqual(['Groceries'])
    expect(rankNotes(rows, 'transfer')).toEqual(['ATM'])
  })
})

describe('noteCompletion', () => {
  const ranked = ['Coffee with Sam', 'Coffee beans', 'Cinema']

  it('finishes the typed text with the best note it starts', () => {
    expect(noteCompletion(ranked, 'Cof')).toBe('fee with Sam')
    expect(noteCompletion(ranked, 'coffee b')).toBe('eans')
  })

  it('offers nothing for too little, no match, or a note already whole', () => {
    expect(noteCompletion(ranked, 'C')).toBeNull()
    expect(noteCompletion(ranked, 'Tea')).toBeNull()
    expect(noteCompletion(ranked, 'Cinema')).toBeNull()
    expect(noteCompletion(ranked, ' Cof')).toBeNull()
  })
})
