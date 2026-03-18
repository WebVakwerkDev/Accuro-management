import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import {
  requireAuth,
  isAuthContext,
  requirePermission,
  parseBody,
  ok,
  created,
  badRequest,
  withErrorHandler,
  parsePagination,
  paginationMeta,
} from '@/lib/api-helpers'
import { createTicketSchema } from '@/lib/validations/ticket'
import { logActivity } from '@/lib/audit'
import { notifyAdmins, notifyTicketAssigned } from '@/lib/notifications'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'tickets:read')
  if (permErr) return permErr

  const { searchParams } = req.nextUrl
  const { page, limit, skip } = parsePagination(searchParams)
  const projectId = searchParams.get('projectId')
  const assignedToId = searchParams.get('assignedToId')
  const search = searchParams.get('search')

  // Validate enum query params upfront — pass bad values to Prisma returns a 400 not a 500.
  const TICKET_STATUSES = ['OPEN','IN_PROGRESS','WAITING_FOR_CLIENT','APPROVAL_PENDING',
    'WAITING_FOR_PAYMENT','FEEDBACK_REQUESTED','IN_REVIEW','DONE','CANCELLED','ON_HOLD'] as const
  const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
  const TICKET_TYPES = ['TASK', 'BUG', 'FEEDBACK', 'FEATURE', 'QUESTION', 'INTAKE'] as const
  type TicketStatus  = typeof TICKET_STATUSES[number]
  type TicketPriority = typeof TICKET_PRIORITIES[number]
  type TicketType    = typeof TICKET_TYPES[number]

  const rawStatus   = searchParams.get('status')
  const rawPriority = searchParams.get('priority')
  const rawType     = searchParams.get('type')

  if (rawStatus   && !(TICKET_STATUSES   as readonly string[]).includes(rawStatus))   return badRequest(`Invalid status: ${rawStatus}`)
  if (rawPriority && !(TICKET_PRIORITIES as readonly string[]).includes(rawPriority)) return badRequest(`Invalid priority: ${rawPriority}`)
  if (rawType     && !(TICKET_TYPES      as readonly string[]).includes(rawType))     return badRequest(`Invalid type: ${rawType}`)

  const status   = rawStatus   as TicketStatus   | null
  const priority = rawPriority as TicketPriority | null
  const type     = rawType     as TicketType     | null

  // Developers only see their assigned tickets
  const isDeveloper = auth.role === 'DEVELOPER'

  const where = {
    deletedAt: null,
    ...(isDeveloper ? { assignedToId: auth.userId } : {}),
    ...(status   ? { status }   : {}),
    ...(priority ? { priority } : {}),
    ...(projectId ? { projectId } : {}),
    ...(assignedToId && !isDeveloper ? { assignedToId } : {}),
    ...(type ? { type } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [tickets, total] = await Promise.all([
    db.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        project: { select: { id: true, title: true, client: { select: { name: true } } } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    }),
    db.ticket.count({ where }),
  ])

  return ok(tickets, paginationMeta(total, page, limit))
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'tickets:write')
  if (permErr) return permErr

  const body = await parseBody(req, createTicketSchema)
  if (body instanceof NextResponse) return body
  const data = body

  const ticket = await db.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      priority: data.priority,
      type: data.type,
      assignedToId: data.assignedToId,
      labels: data.labels,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      estimatedHours: data.estimatedHours,
      createdById: auth.userId,
    },
    include: {
      project: { select: { id: true, title: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  })

  const tasks: Promise<unknown>[] = [
    logActivity({
      entityType: 'ticket',
      entityId: ticket.id,
      userId: auth.userId,
      action: 'created',
      metadata: { title: ticket.title, priority: ticket.priority, type: ticket.type },
      req,
    }),
    notifyAdmins(
      {
        type: 'NEW_TICKET',
        title: `New ticket: ${ticket.title}`,
        entityType: 'ticket',
        entityId: ticket.id,
      },
      auth.userId
    ),
  ]

  if (data.assignedToId && data.assignedToId !== auth.userId) {
    tasks.push(notifyTicketAssigned(ticket.id, ticket.title, data.assignedToId))
  }

  await Promise.all(tasks)
  return created(ticket)
})
