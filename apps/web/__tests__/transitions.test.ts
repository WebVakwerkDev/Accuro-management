import { describe, it, expect } from 'vitest'
import { isValidTicketTransition, allowedTransitionsFrom, TICKET_TRANSITIONS } from '../lib/transitions'
import type { TicketStatus } from '@prisma/client'

const ALL_STATUSES: TicketStatus[] = [
  'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'APPROVAL_PENDING',
  'WAITING_FOR_PAYMENT', 'FEEDBACK_REQUESTED', 'IN_REVIEW',
  'DONE', 'CANCELLED', 'ON_HOLD',
]

describe('isValidTicketTransition', () => {
  it('any status → itself is always valid (idempotent)', () => {
    for (const s of ALL_STATUSES) {
      expect(isValidTicketTransition(s, s)).toBe(true)
    }
  })

  it('OPEN → IN_PROGRESS is valid', () => {
    expect(isValidTicketTransition('OPEN', 'IN_PROGRESS')).toBe(true)
  })

  it('OPEN → DONE is not a valid direct transition', () => {
    expect(isValidTicketTransition('OPEN', 'DONE')).toBe(false)
  })

  it('DONE → IN_PROGRESS is valid (reopen)', () => {
    expect(isValidTicketTransition('DONE', 'IN_PROGRESS')).toBe(true)
  })

  it('CANCELLED → OPEN is valid (reactivate)', () => {
    expect(isValidTicketTransition('CANCELLED', 'OPEN')).toBe(true)
  })

  it('CANCELLED → DONE is not valid', () => {
    expect(isValidTicketTransition('CANCELLED', 'DONE')).toBe(false)
  })

  it('IN_PROGRESS → all work states is valid', () => {
    const validTargets = ['WAITING_FOR_CLIENT', 'APPROVAL_PENDING', 'WAITING_FOR_PAYMENT',
      'FEEDBACK_REQUESTED', 'IN_REVIEW', 'DONE', 'ON_HOLD', 'CANCELLED']
    for (const target of validTargets) {
      expect(isValidTicketTransition('IN_PROGRESS', target as TicketStatus)).toBe(true)
    }
  })

  it('WAITING_FOR_PAYMENT → IN_PROGRESS is not valid (must pay or cancel)', () => {
    expect(isValidTicketTransition('WAITING_FOR_PAYMENT', 'IN_PROGRESS')).toBe(false)
  })

  it('ON_HOLD can be resumed', () => {
    expect(isValidTicketTransition('ON_HOLD', 'OPEN')).toBe(true)
    expect(isValidTicketTransition('ON_HOLD', 'IN_PROGRESS')).toBe(true)
  })
})

describe('allowedTransitionsFrom', () => {
  it('returns non-empty array for all statuses', () => {
    for (const s of ALL_STATUSES) {
      expect(allowedTransitionsFrom(s).length).toBeGreaterThan(0)
    }
  })

  it('does not include the current status in the list', () => {
    for (const s of ALL_STATUSES) {
      expect(allowedTransitionsFrom(s)).not.toContain(s)
    }
  })
})

describe('TICKET_TRANSITIONS map', () => {
  it('covers all statuses', () => {
    for (const s of ALL_STATUSES) {
      expect(TICKET_TRANSITIONS[s]).toBeDefined()
    }
  })

  it('all transition targets are valid statuses', () => {
    for (const [, targets] of Object.entries(TICKET_TRANSITIONS)) {
      for (const t of targets) {
        expect(ALL_STATUSES).toContain(t)
      }
    }
  })
})
