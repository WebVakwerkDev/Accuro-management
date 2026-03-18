/**
 * Structured logger for consistent observability.
 *
 * In production: emits newline-delimited JSON to stdout.
 * In development: pretty-prints with colour coding.
 *
 * Never log secrets, passwords, tokens, or hashes.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  requestId?: string
  userId?: string
  action?: string
  entityType?: string
  entityId?: string
  permission?: string
  statusCode?: number
  durationMs?: number
  error?: string
  [key: string]: unknown
}

function redact(ctx: LogContext): LogContext {
  const out: LogContext = {}
  for (const [k, v] of Object.entries(ctx)) {
    // Never log these keys regardless of value
    if (/password|hash|secret|token|key/i.test(k)) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = v
    }
  }
  return out
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const safe = context ? redact(context) : {}
  const entry = { timestamp: new Date().toISOString(), level, message, ...safe }

  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n')
    return
  }

  const COLORS: Record<LogLevel, string> = {
    debug: '\x1b[90m',
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
  }
  const RESET = '\x1b[0m'
  const prefix = `${COLORS[level]}[${level.toUpperCase()}]${RESET}`
  const ctxStr = Object.keys(safe).length ? ' ' + JSON.stringify(safe) : ''
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](`${prefix} ${message}${ctxStr}`)
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info:  (msg: string, ctx?: LogContext) => emit('info',  msg, ctx),
  warn:  (msg: string, ctx?: LogContext) => emit('warn',  msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),

  /** Log auth events — successful login, logout, token operations. */
  auth(event: string, ctx?: LogContext) {
    emit('info', `[auth] ${event}`, ctx)
  },

  /** Log permission failures — who tried what and was denied. */
  permissionDenied(ctx: { userId: string; role: string; permission: string; path?: string }) {
    emit('warn', '[rbac] permission denied', ctx)
  },

  /** Log all mutating API operations for the audit trail. */
  mutation(action: string, ctx?: LogContext) {
    emit('info', `[mutation] ${action}`, ctx)
  },
}
