import type { Role } from '@prisma/client'

export type Permission =
  // Leads
  | 'leads:read'
  | 'leads:write'
  | 'leads:delete'
  | 'leads:convert'
  // Clients
  | 'clients:read'
  | 'clients:write'
  | 'clients:delete'
  // Projects
  | 'projects:read'
  | 'projects:write'
  | 'projects:delete'
  | 'projects:manage'
  // Tickets
  | 'tickets:read'
  | 'tickets:write'
  | 'tickets:delete'
  | 'tickets:assign'
  // Users
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  // Settings
  | 'settings:read'
  | 'settings:write'
  // API Keys
  | 'api_keys:read'
  | 'api_keys:write'
  | 'api_keys:delete'
  // Notifications
  | 'notifications:read'
  // Reports
  | 'reports:read'
  // Timeline
  | 'timeline:read' | 'timeline:write' | 'timeline:delete'
  // Communications
  | 'communications:read' | 'communications:write'
  // References
  | 'references:read' | 'references:write' | 'references:delete'
  // Wiki
  | 'wiki:read' | 'wiki:write' | 'wiki:delete'
  // GitHub integration
  | 'github:read'    // view linked repos and agent runs
  | 'github:link'    // link a GitHub repo to a ticket
  | 'github:unlink'  // remove a repo link from a ticket
  | 'github:manage'  // create/deactivate GitHubConnections (admin only)
  // Agent runs
  | 'agent:read'     // view agent run history and output
  | 'agent:run'      // trigger PLAN, CREATE_ISSUE, UPDATE_ISSUE, PREPARE_CHANGES, OPEN_PR_DRAFT
  | 'agent:code' // trigger RUN_CODE_AGENT (full autonomous run — restricted)
  | 'agent:cancel'   // cancel an in-progress agent run

// Single source of truth — used by getPermissionsForRole and for Zod enum validation.
export const ALL_PERMISSIONS: readonly Permission[] = [
  'leads:read', 'leads:write', 'leads:delete', 'leads:convert',
  'clients:read', 'clients:write', 'clients:delete',
  'projects:read', 'projects:write', 'projects:delete', 'projects:manage',
  'tickets:read', 'tickets:write', 'tickets:delete', 'tickets:assign',
  'users:read', 'users:write', 'users:delete',
  'settings:read', 'settings:write',
  'api_keys:read', 'api_keys:write', 'api_keys:delete',
  'notifications:read',
  'reports:read',
  'timeline:read', 'timeline:write', 'timeline:delete',
  'communications:read', 'communications:write',
  'references:read', 'references:write', 'references:delete',
  'wiki:read', 'wiki:write', 'wiki:delete',
  'github:read', 'github:link', 'github:unlink', 'github:manage',
  'agent:read', 'agent:run', 'agent:code', 'agent:cancel',
] as const

export const ROLE_PERMISSIONS: Record<Role, Permission[] | ['*']> = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'leads:read',
    'leads:write',
    'leads:delete',
    'leads:convert',
    'clients:read',
    'clients:write',
    'clients:delete',
    'projects:read',
    'projects:write',
    'projects:delete',
    'projects:manage',
    'tickets:read',
    'tickets:write',
    'tickets:delete',
    'tickets:assign',
    'users:read',
    'users:write',
    'settings:read',
    'settings:write',
    'api_keys:read',
    'api_keys:write',
    'api_keys:delete',
    'notifications:read',
    'reports:read',
    'timeline:read',
    'timeline:write',
    'timeline:delete',
    'communications:read',
    'communications:write',
    'references:read',
    'references:write',
    'references:delete',
    'wiki:read',
    'wiki:write',
    'wiki:delete',
    'github:read',
    'github:link',
    'github:unlink',
    'github:manage',
    'agent:read',
    'agent:run',
    'agent:code',
    'agent:cancel',
  ],
  PROJECT_MANAGER: [
    'leads:read',
    'clients:read',
    'clients:write',
    'projects:read',
    'projects:write',
    'projects:manage',
    'tickets:read',
    'tickets:write',
    'tickets:assign',
    'notifications:read',
    'reports:read',
    'timeline:read',
    'timeline:write',
    'timeline:delete',
    'communications:read',
    'communications:write',
    'references:read',
    'references:write',
    'references:delete',
    'wiki:read',
    'wiki:write',
    'wiki:delete',
    'github:read',
    'github:link',
    'github:unlink',
    'agent:read',
    'agent:run',
    'agent:cancel',
  ],
  DEVELOPER: [
    'projects:read',
    'tickets:read',
    'tickets:write',
    'notifications:read',
    'timeline:read',
    'timeline:write',
    'references:read',
    'references:write',
    'wiki:read',
    'communications:read',
    'github:read',
    'agent:read',
    'agent:run',
    'agent:cancel',
  ],
  SALES: [
    'leads:read',
    'leads:write',
    'leads:convert',
    'clients:read',
    'clients:write',
    'projects:read',
    'tickets:read',
    'notifications:read',
    'communications:read',
    'communications:write',
    'references:read',
    'wiki:read',
    'github:read',
    'agent:read',
  ],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  const arr = perms as Array<string>
  if (arr.includes('*')) return true
  return arr.includes(permission)
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

// Derived from ALL_PERMISSIONS — no manual list duplication.
export function getPermissionsForRole(role: Role): Permission[] {
  const perms = ROLE_PERMISSIONS[role] as Array<string>
  if (perms.includes('*')) {
    return [...ALL_PERMISSIONS]
  }
  return perms as Permission[]
}

// Check if a scope string (from API key) matches a permission
export function scopeMatchesPermission(scope: string, permission: Permission): boolean {
  if (scope === '*') return true
  return scope === permission
}

export function apiKeyScopesHavePermission(scopes: string[], permission: Permission): boolean {
  return scopes.some((s) => scopeMatchesPermission(s, permission))
}
