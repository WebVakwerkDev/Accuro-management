import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import {
  requireAuth,
  isAuthContext,
  requirePermission,
  parseBody,
  ok,
  created,
  withErrorHandler,
  parsePagination,
  paginationMeta,
} from '@/lib/api-helpers'
import { createClientSchema } from '@/lib/validations/client'
import { logActivity } from '@/lib/audit'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'clients:read')
  if (permErr) return permErr

  const { searchParams } = req.nextUrl
  const { page, limit, skip } = parsePagination(searchParams)
  const search = searchParams.get('search')

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { companyName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [clients, total] = await Promise.all([
    db.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: { select: { projects: true, leads: true } },
      },
    }),
    db.client.count({ where }),
  ])

  return ok(clients, paginationMeta(total, page, limit))
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'clients:write')
  if (permErr) return permErr

  const body = await parseBody(req, createClientSchema)
  if (body instanceof NextResponse) return body
  const data = body

  const client = await db.client.create({ data })

  await logActivity({
    entityType: 'client',
    entityId: client.id,
    userId: auth.userId,
    action: 'created',
    metadata: { name: client.name },
    req,
  })

  return created(client)
})
