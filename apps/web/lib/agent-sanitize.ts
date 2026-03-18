/**
 * Text sanitization for agent payloads.
 * Kept separate from agent-context.ts so unit tests can import it
 * without pulling in the Prisma db client.
 */

// Patterns that could be used to hijack LLM prompts embedded in ticket content.
const INJECTION_PATTERNS: RegExp[] = [
  /^\s*(system|assistant|human|user)\s*:/gim,
  /^\s*<\s*(system|assistant|human|user)\s*>/gim,
  /\[INST\]/gi,
  /<<SYS>>/gi,
]

export const MAX_FIELD_LENGTH = 4000

/**
 * Sanitizes a single text field.
 * - Strips known prompt-injection prefixes
 * - Hard-caps length at MAX_FIELD_LENGTH characters
 * - Trims whitespace
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return ''
  let result = text
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, '[FILTERED]')
  }
  return result.trim().substring(0, MAX_FIELD_LENGTH)
}
