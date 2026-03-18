/**
 * GitHub token encryption/decryption (AES-256-GCM) and validation.
 * Key is read from GITHUB_TOKEN_ENCRYPTION_KEY (32-byte hex string).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function getKey(): Buffer {
  const raw = process.env.GITHUB_TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY is not set')
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== 32) throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return buf
}

/** Encrypt a plaintext token. Returns a base64 string: iv + tag + ciphertext. */
export function encryptToken(token: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

/** Decrypt a previously encrypted token. Returns the plaintext string. */
export function decryptToken(encrypted: string): string {
  const key = getKey()
  const buf = Buffer.from(encrypted, 'base64')
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** Validate a GitHub token by calling the GitHub API. Returns repo metadata or throws. */
export async function validateGitHubToken(
  token: string,
  owner: string,
  repo: string
): Promise<{ fullName: string; private: boolean; defaultBranch: string }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(8000),
  })

  if (res.status === 401) throw new Error('Invalid GitHub token — authentication failed')
  if (res.status === 403) throw new Error('GitHub token lacks permission to access this repository')
  if (res.status === 404) throw new Error('Repository not found or token has no access')
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)

  const data = await res.json() as { full_name: string; private: boolean; default_branch: string }
  return {
    fullName: data.full_name,
    private: data.private,
    defaultBranch: data.default_branch,
  }
}

/** Get a decrypted token for a stored connection, or null if none. */
export function getDecryptedToken(encryptedToken: string | null): string | null {
  if (!encryptedToken) return null
  try {
    return decryptToken(encryptedToken)
  } catch {
    return null
  }
}
