import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import crypto from 'crypto'
import db from './db'
import { logger } from './logger'

// Lazy secret resolution — checked on first request, not at build time.
// Next.js loads route modules during build without env vars being present.
function getSecret(name: string): Uint8Array {
  const value = process.env[name]
  if (!value || value.length < 32) {
    throw new Error(
      `Required environment variable ${name} is not set or shorter than 32 characters. ` +
      `The application cannot handle authenticated requests without it.`
    )
  }
  return new TextEncoder().encode(value)
}

// Memoised after first successful access
let _jwtSecret: Uint8Array | undefined
let _refreshSecret: Uint8Array | undefined

function JWT_SECRET(): Uint8Array {
  return (_jwtSecret ??= getSecret('JWT_SECRET'))
}
function REFRESH_SECRET(): Uint8Array {
  return (_refreshSecret ??= getSecret('REFRESH_TOKEN_SECRET'))
}

export interface JWTPayload {
  sub: string      // userId
  email: string
  role: string
  iat?: number
  exp?: number
}

export interface RefreshPayload {
  sub: string
  family: string
  tokenId: string
}

// ─── Token generation ─────────────────────────────────────────────────────────

export async function signAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET())
}

export async function signRefreshToken(
  userId: string,
  family: string,
  tokenId: string
): Promise<string> {
  return new SignJWT({ family, tokenId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(REFRESH_SECRET())
}

// ─── Token verification ───────────────────────────────────────────────────────

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET())
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as string,
    }
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET())
    return {
      sub: payload.sub as string,
      family: payload.family as string,
      tokenId: payload.tokenId as string,
    }
  } catch {
    return null
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const cookieStore = await cookies()
  const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false

  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  })

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/api/v1/auth/refresh',
  })
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('access_token')
  cookieStore.delete('refresh_token')
}

// ─── Get current user ─────────────────────────────────────────────────────────

export async function getCurrentUser(req?: NextRequest): Promise<JWTPayload | null> {
  let token: string | undefined

  if (req) {
    token = req.cookies.get('access_token')?.value
  } else {
    const cookieStore = await cookies()
    token = cookieStore.get('access_token')?.value
  }

  if (!token) return null
  return verifyAccessToken(token)
}

// ─── Refresh token rotation ───────────────────────────────────────────────────

export async function rotateRefreshToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  user: { id: string; email: string; role: string }
} | null> {
  const payload = await verifyRefreshToken(refreshToken)
  if (!payload) return null

  // Look up the stored token
  const stored = await db.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  })

  if (!stored || stored.expiresAt < new Date()) {
    // Expired or not found — invalidate entire family (protection against replay)
    if (stored) {
      await db.refreshToken.deleteMany({ where: { family: stored.family } })
      logger.warn('[auth] refresh token expired, family invalidated', { family: stored.family })
    }
    return null
  }

  if (stored.usedAt) {
    // Token reuse detected — invalidate entire family (stolen token protection)
    await db.refreshToken.deleteMany({ where: { family: stored.family } })
    logger.warn('[auth] refresh token reuse detected — family invalidated', {
      userId: stored.userId,
      family: stored.family,
    })
    return null
  }

  const user = stored.user
  const newFamily = stored.family
  const newTokenId = crypto.randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // Sign the new refresh token first, then perform two DB writes atomically:
  // 1. Mark old token as used
  // 2. Insert new token
  // Both reference different rows so no race condition exists.
  const [accessToken, newRefreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    signRefreshToken(user.id, newFamily, newTokenId),
  ])

  await db.$transaction([
    db.refreshToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    }),
    db.refreshToken.create({
      data: {
        token: newRefreshToken, // store the signed JWT — consistent with createSession
        userId: user.id,
        family: newFamily,
        expiresAt,
      },
    }),
  ])

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: { id: user.id, email: user.email, role: user.role },
  }
}

// ─── Create session (login) ───────────────────────────────────────────────────

export async function createSession(userId: string): Promise<{
  accessToken: string
  refreshToken: string
}> {
  const family = crypto.randomBytes(16).toString('hex')
  const tokenId = crypto.randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  })

  if (!user) throw new Error('User not found')

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  const refreshToken = await signRefreshToken(user.id, family, tokenId)

  await db.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      family,
      expiresAt,
    },
  })

  return { accessToken, refreshToken }
}

// ─── Revoke session ───────────────────────────────────────────────────────────

export async function revokeSession(refreshToken: string): Promise<void> {
  await db.refreshToken.deleteMany({ where: { token: refreshToken } })
}

// ─── API Key auth ─────────────────────────────────────────────────────────────

// Throttle lastUsedAt writes to at most once per minute per key.
// Fire-and-forget — never block the request on this write.
const LAST_USED_THRESHOLD_MS = 60 * 1000

export async function verifyApiKey(apiKey: string): Promise<{
  userId: string
  scopes: string[]
} | null> {
  if (!apiKey.startsWith('wv_')) return null

  const hash = crypto.createHash('sha256').update(apiKey).digest('hex')

  const key = await db.apiKey.findUnique({
    where: { keyHash: hash },
    select: {
      id: true,
      isActive: true,
      expiresAt: true,
      scopes: true,
      createdById: true,
      lastUsedAt: true,
    },
  })

  if (!key || !key.isActive) return null
  if (key.expiresAt && key.expiresAt < new Date()) return null

  // Throttled fire-and-forget — never block the request on this write
  const shouldUpdate =
    !key.lastUsedAt ||
    Date.now() - key.lastUsedAt.getTime() > LAST_USED_THRESHOLD_MS

  if (shouldUpdate) {
    db.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch((err) => logger.error('Failed to update API key lastUsedAt', { error: String(err) }))
  }

  return { userId: key.createdById, scopes: key.scopes }
}
