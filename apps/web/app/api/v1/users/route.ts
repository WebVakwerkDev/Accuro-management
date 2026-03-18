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
  created,
  conflict,
  withErrorHandler,
  parsePagination,
  paginationMeta,
} from '@/lib/api-helpers'
import { logActivity } from '@/lib/audit'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'SALES']).default('DEVELOPER'),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'users:read')
  if (permErr) return permErr

  const { searchParams } = req.nextUrl
  const { page, limit, skip } = parsePagination(searchParams)

  const [users, total] = await Promise.all([
    db.user.findMany({
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
    db.user.count(),
  ])

  return ok(users, paginationMeta(total, page, limit))
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'users:write')
  if (permErr) return permErr

  const body = await parseBody(req, createUserSchema)
  if (body instanceof NextResponse) return body
  const data = body

  const existing = await db.user.findUnique({
    where: { email: data.email.toLowerCase() },
  })
  if (existing) return conflict('Email already in use')

  const passwordHash = await bcrypt.hash(data.password, 12)

  const user = await db.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash,
      role: data.role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  await logActivity({
    entityType: 'user',
    entityId: user.id,
    userId: auth.userId,
    action: 'created',
    metadata: { email: user.email, role: user.role },
    req,
  })

  return created(user)
})
