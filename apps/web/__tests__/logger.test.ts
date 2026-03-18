import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must run before logger module load to avoid process.stdout.write in test output
process.env.NODE_ENV = 'test'

const { logger } = await import('../lib/logger')

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('exposes debug, info, warn, error methods', () => {
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('redacts password fields', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    logger.info('test', { password: 'super_secret', userId: 'u1' })

    const calls = writeSpy.mock.calls
    const written = calls.map((c) => c[0]).join('')
    expect(written).toContain('[REDACTED]')
    expect(written).not.toContain('super_secret')
    expect(written).toContain('u1')

    process.env.NODE_ENV = origEnv
    writeSpy.mockRestore()
  })

  it('redacts token fields', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    logger.info('test', { accessToken: 'jwt.token.here', userId: 'u2' })

    const written = writeSpy.mock.calls.map((c) => c[0]).join('')
    expect(written).not.toContain('jwt.token.here')

    process.env.NODE_ENV = origEnv
    writeSpy.mockRestore()
  })

  it('does not redact non-sensitive fields', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    logger.info('test', { entityId: 'ticket_123', action: 'created' })

    const written = writeSpy.mock.calls.map((c) => c[0]).join('')
    expect(written).toContain('ticket_123')
    expect(written).toContain('created')

    process.env.NODE_ENV = origEnv
    writeSpy.mockRestore()
  })
})
