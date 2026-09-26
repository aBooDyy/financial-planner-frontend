import { describe, expect, it } from 'vitest'
import type { InboxMessage } from '#/features/email-sync/api/types'
import {
  groupMessages,
  groupsForSenders,
  mergeMessages,
  similarOf,
} from './samples'

const message = (
  id: string,
  groupId: string,
  over: Partial<InboxMessage> = {},
): InboxMessage => ({
  id,
  senderEmail: 'alerts@bank.com',
  senderName: 'Bank',
  subject: `Subject ${id}`,
  date: '2026-09-20',
  bodyLines: [`Amount: SAR ${id}`],
  preview: '',
  likely: false,
  groupId,
  ...over,
})

describe('groupMessages', () => {
  it('folds a template’s emails into one group led by the newest', () => {
    const groups = groupMessages([
      message('m1', 'g1'),
      message('m2', 'g2'),
      message('m3', 'g1'),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].representative.id).toBe('m1')
    expect(groups[0].members.map((m) => m.id)).toEqual(['m1', 'm3'])
  })

  it('puts groups that look like alerts first, keeping the order within each half', () => {
    const groups = groupMessages([
      message('m1', 'news'),
      message('m2', 'card', { likely: true }),
      message('m3', 'promo'),
      message('m4', 'transfer', { likely: true }),
    ])
    expect(groups.map((g) => g.id)).toEqual([
      'card',
      'transfer',
      'news',
      'promo',
    ])
  })

  it('marks a group likely when any member is', () => {
    const [group] = groupMessages([
      message('m1', 'g1'),
      message('m2', 'g1', { likely: true }),
    ])
    expect(group.likely).toBe(true)
  })
})

describe('sample helpers', () => {
  it('adds newly listed mail without repeating what is loaded', () => {
    const merged = mergeMessages(
      [message('m1', 'g1'), message('m2', 'g1')],
      [message('m2', 'g1'), message('m3', 'g2')],
    )
    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('reads the group’s other members, within the server’s sample cap', () => {
    const [group] = groupMessages(
      ['m1', 'm2', 'm3', 'm4'].map((id) => message(id, 'g1')),
    )
    const similar = similarOf(group, 3)
    expect(similar.map((s) => s.id)).toEqual(['m2', 'm3'])
    expect(similar[0].bodyLines).toEqual(['Amount: SAR m2'])
  })

  it('lists the rule’s own senders first', () => {
    const groups = groupMessages([
      message('m1', 'g1', { senderEmail: 'news@shop.com' }),
      message('m2', 'g2', { senderEmail: 'Alerts@Bank.com' }),
    ])
    expect(
      groupsForSenders(groups, ['alerts@bank.com']).map((g) => g.id),
    ).toEqual(['g2', 'g1'])
  })
})
