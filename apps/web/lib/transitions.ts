/**
 * Valid status transitions for tickets.
 *
 * Any transition NOT in this map is rejected at the API layer.
 * SUPER_ADMIN and ADMIN can bypass transition guards via `force: true`
 * if that option is ever added — for now all roles go through the same guard.
 */

import type { TicketStatus } from '@prisma/client'

export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [
    'IN_PROGRESS',
    'ON_HOLD',
    'CANCELLED',
  ],
  IN_PROGRESS: [
    'WAITING_FOR_CLIENT',
    'APPROVAL_PENDING',
    'WAITING_FOR_PAYMENT',
    'FEEDBACK_REQUESTED',
    'IN_REVIEW',
    'DONE',
    'ON_HOLD',
    'CANCELLED',
  ],
  WAITING_FOR_CLIENT: [
    'IN_PROGRESS',
    'DONE',
    'ON_HOLD',
    'CANCELLED',
  ],
  APPROVAL_PENDING: [
    'IN_PROGRESS',
    'DONE',
    'CANCELLED',
  ],
  WAITING_FOR_PAYMENT: [
    'DONE',
    'CANCELLED',
  ],
  FEEDBACK_REQUESTED: [
    'IN_PROGRESS',
    'DONE',
    'CANCELLED',
  ],
  IN_REVIEW: [
    'IN_PROGRESS',
    'DONE',
    'CANCELLED',
  ],
  DONE: [
    'IN_PROGRESS', // reopen
    'CANCELLED',
  ],
  CANCELLED: [
    'OPEN', // reactivate
  ],
  ON_HOLD: [
    'OPEN',
    'IN_PROGRESS',
    'CANCELLED',
  ],
}

/**
 * Returns true if moving from `from` → `to` is allowed.
 * Moving to the current status is always valid (idempotent).
 */
export function isValidTicketTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true
  return TICKET_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Returns the list of statuses the ticket can legally move to from `current`.
 */
export function allowedTransitionsFrom(current: TicketStatus): TicketStatus[] {
  return TICKET_TRANSITIONS[current] ?? []
}
