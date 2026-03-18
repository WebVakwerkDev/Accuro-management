/**
 * Agent context builder.
 *
 * Assembles and sanitizes the payload that is sent to the external automation
 * layer when an agent run is triggered. Sanitization prevents prompt injection
 * via customer-supplied content (ticket descriptions, communications, etc.).
 */

import db from './db'
import { sanitizeText } from './agent-sanitize'

// Re-export so callers don't need to know about the split module.
export { sanitizeText } from './agent-sanitize'

const MAX_ITEMS = 10

// ─── Context options ──────────────────────────────────────────────────────────

export interface AgentContextOptions {
  includeTimeline?: boolean
  includeCommunications?: boolean
  includeReferences?: boolean
  includeWikiLinks?: boolean
  instructions?: string
}

// ─── Built context shape ──────────────────────────────────────────────────────

export interface AgentTicketContext {
  ticket: {
    id: string
    title: string
    description: string
    status: string
    priority: string
    type: string
    project: { id: string; title: string } | null
    client: { name: string } | null
  }
  repository: {
    owner: string
    repo: string
    defaultBranch: string
    linkedBranch: string | null
    linkedIssueNumber: number | null
    linkedPullRequestNumber: number | null
  }
  timeline: Array<{ type: string; content: string | null; createdAt: string }> | null
  communications: Array<{ direction: string; channel: string; subject: string | null; body: string; createdAt: string }> | null
  references: Array<{ title: string; url: string; type: string }> | null
  wikiLinks: Array<{ title: string; slug: string }> | null
  instructions: string
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export async function buildAgentContext(
  ticketId: string,
  repositoryLinkId: string,
  options: AgentContextOptions = {}
): Promise<AgentTicketContext> {
  const {
    includeTimeline = true,
    includeCommunications = true,
    includeReferences = true,
    includeWikiLinks = true,
    instructions = '',
  } = options

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId, deletedAt: null },
    include: {
      project: { select: { id: true, title: true, client: { select: { name: true } } } },
      timelineEntries: includeTimeline
        ? { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: MAX_ITEMS }
        : false,
      communications: includeCommunications
        ? { orderBy: { createdAt: 'desc' }, take: MAX_ITEMS }
        : false,
      references: includeReferences
        ? { orderBy: { createdAt: 'desc' }, take: MAX_ITEMS }
        : false,
      wikiLinks: includeWikiLinks
        ? { include: { wikiPage: { select: { title: true, slug: true } } }, take: MAX_ITEMS }
        : false,
    },
  })

  if (!ticket) throw new Error(`Ticket ${ticketId} not found`)

  const repoLink = await db.ticketRepositoryLink.findUnique({
    where: { id: repositoryLinkId },
    include: { githubConnection: true },
  })

  if (!repoLink) throw new Error(`Repository link ${repositoryLinkId} not found`)

  return {
    ticket: {
      id: ticket.id,
      title: sanitizeText(ticket.title),
      description: sanitizeText(ticket.description),
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      project: ticket.project
        ? { id: ticket.project.id, title: sanitizeText(ticket.project.title) }
        : null,
      client: ticket.project?.client
        ? { name: sanitizeText(ticket.project.client.name) }
        : null,
    },
    repository: {
      owner: repoLink.githubConnection.owner,
      repo: repoLink.githubConnection.repo,
      defaultBranch: repoLink.githubConnection.defaultBranch,
      linkedBranch: repoLink.linkedBranch,
      linkedIssueNumber: repoLink.linkedIssueNumber,
      linkedPullRequestNumber: repoLink.linkedPullRequestNumber,
    },
    timeline: includeTimeline && ticket.timelineEntries
      ? (ticket.timelineEntries as any[]).map((e) => ({
          type: e.type,
          content: sanitizeText(e.content),
          createdAt: e.createdAt.toISOString(),
        }))
      : null,
    communications: includeCommunications && ticket.communications
      ? (ticket.communications as any[]).map((c) => ({
          direction: c.direction,
          channel: c.channel,
          subject: sanitizeText(c.subject),
          body: sanitizeText(c.body),
          createdAt: c.createdAt.toISOString(),
        }))
      : null,
    references: includeReferences && ticket.references
      ? (ticket.references as any[]).map((r) => ({
          title: sanitizeText(r.title),
          url: r.url,
          type: r.type,
        }))
      : null,
    wikiLinks: includeWikiLinks && ticket.wikiLinks
      ? (ticket.wikiLinks as any[]).map((w) => ({
          title: sanitizeText(w.wikiPage.title),
          slug: w.wikiPage.slug,
        }))
      : null,
    instructions: sanitizeText(instructions),
  }
}
