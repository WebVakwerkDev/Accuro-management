import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import db from '@/lib/db'
import {
  requireAuth,
  isAuthContext,
  requirePermission,
  parseBody,
  ok,
  created,
  forbidden,
  badRequest,
  withErrorHandler,
} from '@/lib/api-helpers'
import { z } from 'zod'
import { logActivity } from '@/lib/audit'
import { ALL_PERMISSIONS } from '@/lib/rbac'

// Scopes must be valid permission strings or '*' (wildcard, SUPER_ADMIN only)
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z
    .array(z.string().min(1).max(100))
    .min(1)
    .refine(
      (scopes) =>
        scopes.every(
          (s) => s === '*' || (ALL_PERMISSIONS as readonly string[]).includes(s)
        ),
      {
        message: 'Invalid scope — must be a valid permission or "*"',
      }
    ),
  expiresAt: z.string().datetime().optional(),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'api_keys:read')
  if (permErr) return permErr

  const apiKeys = await db.apiKey.findMany({
    where: {
      createdById: auth.userId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(apiKeys)
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req)
  if (!isAuthContext(auth)) return auth

  const permErr = requirePermission(auth, 'api_keys:write')
  if (permErr) return permErr

  const body = await parseBody(req, createApiKeySchema)
  if (body instanceof NextResponse) return body
  const data = body

  // Wildcard scope grants full system access — only SUPER_ADMIN may issue it
  if (data.scopes.includes('*') && auth.role !== 'SUPER_ADMIN') {
    return forbidden('Only SUPER_ADMIN can create wildcard-scoped API keys')
  }

  // Generate the raw key
  const rawKey = `wv_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.substring(0, 10) // "wv_" + 7 chars

  const apiKey = await db.apiKey.create({
    data: {
      name: data.name,
      keyHash,
      keyPrefix,
      scopes: data.scopes,
      createdById: auth.userId,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  await logActivity({
    entityType: 'api_key',
    entityId: apiKey.id,
    userId: auth.userId,
    action: 'created',
    metadata: { name: data.name, scopes: data.scopes },
    req,
  })

  // Return the raw key ONCE — it will never be retrievable again
  return created({
    ...apiKey,
    key: rawKey,
    warning: 'Save this key securely. It will not be shown again.',
  })
})
