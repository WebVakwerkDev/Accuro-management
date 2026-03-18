/**
 * Callback authentication.
 *
 * Validates HMAC-SHA256 signatures on inbound webhook callbacks from the
 * external automation layer. Uses timing-safe comparison to prevent
 * timing-based signature forgery.
 *
 * Expected header: X-Agent-Signature: sha256=<hex>
 */

async function hmacSign(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Timing-safe string comparison (prevents timing attacks on HMAC comparison). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Returns true if the X-Agent-Signature header matches the expected
 * HMAC-SHA256 of the raw request body using AGENT_CALLBACK_SECRET.
 */
export async function validateCallbackSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  const secret = process.env.AGENT_CALLBACK_SECRET
  if (!secret) {
    // No secret configured — reject all callbacks for safety.
    return false
  }

  if (!signatureHeader) return false

  // Header format: "sha256=<hex>"
  const prefix = 'sha256='
  if (!signatureHeader.startsWith(prefix)) return false

  const receivedSig = signatureHeader.slice(prefix.length)
  const expectedSig = await hmacSign(secret, rawBody)

  return timingSafeEqual(expectedSig, receivedSig)
}
