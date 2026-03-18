import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissionsForRole,
  apiKeyScopesHavePermission,
  ALL_PERMISSIONS,
  type Permission,
} from '../lib/rbac'

describe('hasPermission', () => {
  it('SUPER_ADMIN has every permission', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(hasPermission('SUPER_ADMIN', perm)).toBe(true)
    }
  })

  it('DEVELOPER has tickets:read but not tickets:delete', () => {
    expect(hasPermission('DEVELOPER', 'tickets:read')).toBe(true)
    expect(hasPermission('DEVELOPER', 'tickets:delete')).toBe(false)
  })

  it('DEVELOPER cannot access users or settings', () => {
    expect(hasPermission('DEVELOPER', 'users:read')).toBe(false)
    expect(hasPermission('DEVELOPER', 'settings:write')).toBe(false)
  })

  it('SALES cannot delete leads', () => {
    expect(hasPermission('SALES', 'leads:delete')).toBe(false)
  })

  it('SALES can convert leads', () => {
    expect(hasPermission('SALES', 'leads:convert')).toBe(true)
  })

  it('PROJECT_MANAGER can assign tickets', () => {
    expect(hasPermission('PROJECT_MANAGER', 'tickets:assign')).toBe(true)
  })

  it('ADMIN does not have users:delete', () => {
    expect(hasPermission('ADMIN', 'users:delete')).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('returns true if any permission matches', () => {
    expect(hasAnyPermission('DEVELOPER', ['tickets:read', 'tickets:delete'])).toBe(true)
  })

  it('returns false if none match', () => {
    expect(hasAnyPermission('DEVELOPER', ['users:read', 'users:delete'])).toBe(false)
  })
})

describe('hasAllPermissions', () => {
  it('returns true only when all match', () => {
    expect(hasAllPermissions('ADMIN', ['tickets:read', 'tickets:write', 'tickets:delete'])).toBe(true)
  })

  it('returns false if any are missing', () => {
    expect(hasAllPermissions('DEVELOPER', ['tickets:read', 'tickets:delete'])).toBe(false)
  })
})

describe('getPermissionsForRole', () => {
  it('SUPER_ADMIN gets all permissions', () => {
    const perms = getPermissionsForRole('SUPER_ADMIN')
    expect(perms).toHaveLength(ALL_PERMISSIONS.length)
    for (const p of ALL_PERMISSIONS) {
      expect(perms).toContain(p)
    }
  })

  it('DEVELOPER gets a subset', () => {
    const perms = getPermissionsForRole('DEVELOPER')
    expect(perms.length).toBeGreaterThan(0)
    expect(perms.length).toBeLessThan(ALL_PERMISSIONS.length)
    expect(perms).not.toContain('users:delete')
  })

  it('does not return the wildcard string itself', () => {
    const perms = getPermissionsForRole('SUPER_ADMIN')
    expect(perms).not.toContain('*')
  })
})

describe('apiKeyScopesHavePermission', () => {
  it('wildcard scope grants any permission', () => {
    expect(apiKeyScopesHavePermission(['*'], 'tickets:delete')).toBe(true)
    expect(apiKeyScopesHavePermission(['*'], 'users:delete')).toBe(true)
  })

  it('specific scopes are checked exactly', () => {
    expect(apiKeyScopesHavePermission(['tickets:read'], 'tickets:read')).toBe(true)
    expect(apiKeyScopesHavePermission(['tickets:read'], 'tickets:write')).toBe(false)
  })

  it('empty scopes deny everything', () => {
    expect(apiKeyScopesHavePermission([], 'tickets:read')).toBe(false)
  })

  it('multiple specific scopes work', () => {
    expect(apiKeyScopesHavePermission(['tickets:read', 'tickets:write'], 'tickets:write')).toBe(true)
    expect(apiKeyScopesHavePermission(['tickets:read', 'tickets:write'], 'tickets:delete')).toBe(false)
  })
})

describe('ALL_PERMISSIONS', () => {
  it('contains no duplicates', () => {
    const set = new Set(ALL_PERMISSIONS)
    expect(set.size).toBe(ALL_PERMISSIONS.length)
  })

  it('every entry matches the Permission type pattern', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(p).toMatch(/^[a-z_]+:[a-z]+$/)
    }
  })
})
