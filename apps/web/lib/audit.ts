import { NextRequest } from 'next/server'
import db from './db'

export interface LogActivityParams {
  entityType: string
  entityId: string
  userId?: string
  action: string
  metadata?: Record<string, unknown>
  req?: NextRequest
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const ipAddress = params.req
    ? getIpFromRequest(params.req)
    : undefined

  const userAgent = params.req
    ? params.req.headers.get('user-agent') ?? undefined
    : undefined

  await db.activityLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      action: params.action,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: params.metadata ? (params.metadata as any) : undefined,
      ipAddress,
      userAgent,
    },
  })
}

export async function recordStatusChange(params: {
  entityType: string
  entityId: string
  fromStatus: string | null
  toStatus: string
  changedById: string
  reason?: string
}): Promise<void> {
  await db.statusHistory.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      changedById: params.changedById,
      reason: params.reason,
    },
  })
}

function getIpFromRequest(req: NextRequest): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return undefined
}
