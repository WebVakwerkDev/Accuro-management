import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from './lib/auth'

// Public routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/health',
]

// API routes that accept either JWT or API key (handled in route handlers)
const API_PREFIX = '/api/v1/'

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  // Always allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static files and Next.js internals.
  // Use an explicit extension list — pathname.includes('.') is too broad
  // and would bypass auth for paths like /api/v1/some.endpoint.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|otf|map)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // For API routes: check JWT cookie or API key header (actual auth done in route handlers)
  if (pathname.startsWith(API_PREFIX)) {
    const accessToken = req.cookies.get('access_token')?.value
    const apiKey = req.headers.get('x-api-key')

    if (!accessToken && !apiKey) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (accessToken) {
      const payload = await verifyAccessToken(accessToken)
      if (!payload) {
        // Token invalid — let client know to refresh
        return NextResponse.json(
          { success: false, error: 'Access token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }
    }
    // API key will be verified in the route handler itself
    return NextResponse.next()
  }

  // Dashboard routes: require JWT
  const accessToken = req.cookies.get('access_token')?.value

  if (!accessToken) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifyAccessToken(accessToken)
  if (!payload) {
    // Token expired — redirect to refresh or login
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    loginUrl.searchParams.set('reason', 'session_expired')
    return NextResponse.redirect(loginUrl)
  }

  // Add user info to headers for server components
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-id', payload.sub)
  requestHeaders.set('x-user-email', payload.email)
  requestHeaders.set('x-user-role', payload.role)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
