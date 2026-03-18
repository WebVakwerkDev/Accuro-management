/**
 * Agent dispatch.
 *
 * Sends a signed payload to the external automation layer (n8n / custom worker).
 * The external system executes the run and reports status via the callback endpoint.
 *
 * Environment variables:
 *   AGENT_DISPATCH_URL     — where to POST runs (leave unset to stay in QUEUED state)
 *   AGENT_CALLBACK_SECRET  — HMAC-SHA256 secret shared with the automation layer
 *   AGENT_CALLBACK_URL     — the URL this app accepts callbacks on (sent in payload)
 */

import type { AgentTicketContext } from './agent-context'

// ─── HMAC signing ─────────────────────────────────────────────────────────────

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

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export interface DispatchPayload {
  runId: string
  runType: string
  callbackUrl: string
  context: AgentTicketContext
}

/**
 * Sends the agent run to the configured dispatch URL.
 * Returns the externalRunId if the automation layer provides one, or null.
 * Throws on HTTP errors.
 */
export async function dispatchAgentRun(
  runId: string,
  runType: string,
  context: AgentTicketContext
): Promise<string | null> {
  const dispatchUrl = process.env.AGENT_DISPATCH_URL
  if (!dispatchUrl) {
    // No dispatch URL configured — run stays QUEUED until manually processed.
    return null
  }

  const secret = process.env.AGENT_CALLBACK_SECRET ?? ''
  const callbackUrl =
    process.env.AGENT_CALLBACK_URL ??
    `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/v1/integrations/github/agent-runs/callback`

  const payload: DispatchPayload = { runId, runType, callbackUrl, context }
  const body = JSON.stringify(payload)
  const signature = await hmacSign(secret, body)

  const res = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Signature': `sha256=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(10_000), // 10 s dispatch timeout
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Dispatch failed (${res.status}): ${text.substring(0, 200)}`)
  }

  const data = await res.json().catch(() => ({}))
  return typeof data.externalRunId === 'string' ? data.externalRunId : null
}
