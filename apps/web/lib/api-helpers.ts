import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'
import { getCurrentUser, verifyApiKey } from './auth'
import { hasPermission, apiKeyScopesHavePermission, type Permission } from './rbac'
import { logger } from './logger'
import db from './db'
import type { Role } from '@prisma/client'

// ─── Response helpers ─────────────────────────────────────────────────────────

export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: true, data, ...( meta ? { meta } : {}) }, { status: 200 })
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 201 })
}

export function badRequest(message: string, errors?: unknown): NextResponse {
  return NextResponse.json(
    { success: false, error: message, ...(errors ? { errors } : {}) },
    { status: 400 }
  )
}

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 403 })
}

export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 404 })
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 409 })
}

export function serverError(message = 'Internal server error'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}

export function validationError(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      errors: error.flatten().fieldErrors,
    },
    { status: 422 }
  )
}

export function tooManyRequests(reset: number): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Too many requests' },
    {
      status: 429,
      headers: {
        'Retry-After': String(reset - Math.floor(Date.now() / 1000)),
        'X-RateLimit-Reset': String(reset),
      },
    }
  )
}

// ─── Auth context ─────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string
  email: string
  role: Role
  isApiKey: boolean
  scopes?: string[]
}

export async function requireAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  // 1. Try JWT cookie first
  const jwtUser = await getCurrentUser(req)
  if (jwtUser) {
    const user = await db.user.findUnique({
      where: { id: jwtUser.sub, isActive: true },
      select: { id: true, email: true, role: true },
    })
    if (!user) return unauthorized()
    return { userId: user.id, email: user.email, role: user.role, isApiKey: false }
  }

  // 2. Try API key header
  const apiKeyHeader = req.headers.get('x-api-key')
  if (apiKeyHeader) {
    const keyData = await verifyApiKey(apiKeyHeader)
    if (!keyData) return unauthorized('Invalid or expired API key')

    const user = await db.user.findUnique({
      where: { id: keyData.userId, isActive: true },
      select: { id: true, email: true, role: true },
    })
    if (!user) return unauthorized()

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      isApiKey: true,
      scopes: keyData.scopes,
    }
  }

  return unauthorized()
}

// Use instanceof for a reliable type guard — duck-typing on 'status' is fragile.
export function isAuthContext(value: AuthContext | NextResponse): value is AuthContext {
  return !(value instanceof NextResponse)
}

export function requirePermission(
  auth: AuthContext,
  permission: Permission
): NextResponse | null {
  // API key auth: check scopes
  if (auth.isApiKey && auth.scopes) {
    if (!apiKeyScopesHavePermission(auth.scopes, permission)) {
      logger.permissionDenied({
        userId: auth.userId,
        role: auth.role,
        permission,
      })
      return forbidden(`API key missing scope: ${permission}`)
    }
    return null
  }
  // JWT auth: check RBAC
  if (!hasPermission(auth.role, permission)) {
    logger.permissionDenied({
      userId: auth.userId,
      role: auth.role,
      permission,
    })
    return forbidden(`Missing permission: ${permission}`)
  }
  return null
}

// ─── Body parsing ─────────────────────────────────────────────────────────────

export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<T | NextResponse> {
  try {
    const body = await req.json()
    const result = schema.safeParse(body)
    if (!result.success) {
      return validationError(result.error)
    }
    return result.data
  } catch {
    return badRequest('Invalid JSON body')
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  }
}

// ─── Handler wrapper ──────────────────────────────────────────────────────────

export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (error) {
      logger.error('Unhandled error in API route', {
        error: error instanceof Error ? error.message : String(error),
      })
      return serverError()
    }
  }
}
