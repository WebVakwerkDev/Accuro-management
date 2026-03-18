import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import {
  requireAuth,
  isAuthContext,
  requirePermission,
  parseBody,
  ok,
  notFound,
  withErrorHandler,
} from '@/lib/api-helpers'
import { updateClientSchema } from '@/lib/validations/client'
import { logActivity } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

export const GET = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'clients:read')
  if (permErr) return permErr

  const client = await db.client.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: true,
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true, createdAt: true },
      },
      projects: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true, packageType: true, createdAt: true },
      },
    },
  })

  if (!client) return notFound('Client not found')
  return ok(client)
})

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'clients:write')
  if (permErr) return permErr

  const client = await db.client.findFirst({ where: { id, deletedAt: null } })
  if (!client) return notFound('Client not found')

  const body = await parseBody(req, updateClientSchema)
  if (body instanceof NextResponse) return body
  const data = body

  const updated = await db.client.update({ where: { id }, data })

  await logActivity({
    entityType: 'client',
    entityId: id,
    userId: auth.userId,
    action: 'updated',
    metadata: { changes: data },
    req,
  })

  return ok(updated)
})

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'clients:delete')
  if (permErr) return permErr

  const client = await db.client.findFirst({ where: { id, deletedAt: null } })
  if (!client) return notFound('Client not found')

  await db.client.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })

  await logActivity({
    entityType: 'client',
    entityId: id,
    userId: auth.userId,
    action: 'deleted',
    req,
  })

  return ok({ message: 'Client deleted' })
})
