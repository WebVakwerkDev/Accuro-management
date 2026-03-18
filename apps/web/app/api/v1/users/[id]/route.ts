import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import db from '@/lib/db'
import {
  requireAuth,
  isAuthContext,
  requirePermission,
  parseBody,
  ok,
  notFound,
  forbidden,
  withErrorHandler,
} from '@/lib/api-helpers'
import { logActivity } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'SALES']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
})

export const GET = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'users:read')
  if (permErr) return permErr

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { assignedTickets: true, createdLeads: true },
      },
    },
  })

  if (!user) return notFound('User not found')
  return ok(user)
})

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  // Users can update their own profile, admins can update anyone
  if (id !== auth.userId) {
    const permErr = requirePermission(auth, 'users:write')
    if (permErr) return permErr
  }

  const user = await db.user.findUnique({ where: { id } })
  if (!user) return notFound('User not found')

  // Only SUPER_ADMIN can change roles
  const body = await parseBody(req, updateUserSchema)
  if (body instanceof NextResponse) return body
  const data = body

  if (data.role && auth.role !== 'SUPER_ADMIN') {
    return forbidden('Only SUPER_ADMIN can change user roles')
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.role !== undefined) updateData.role = data.role
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 12)

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  })

  await logActivity({
    entityType: 'user',
    entityId: id,
    userId: auth.userId,
    action: 'updated',
    metadata: { changes: { ...data, password: data.password ? '[changed]' : undefined } },
    req,
  })

  return ok(updated)
})
