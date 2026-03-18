import db from './db'
import { Prisma } from '@prisma/client'
import type { TimelineEntryType } from '@prisma/client'

type CreateSystemEntryParams = {
  ticketId: string
  type: Exclude<TimelineEntryType, 'NOTE'>
  authorId?: string
  metadata?: Record<string, unknown>
}

export async function createTimelineEntry(params: CreateSystemEntryParams) {
  return db.ticketTimelineEntry.create({
    data: {
      ticketId: params.ticketId,
      type: params.type,
      authorId: params.authorId ?? null,
      content: null,
      metadata: params.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
    },
  })
}

export async function logStatusChange(params: {
  ticketId: string
  authorId: string
  oldStatus: string
  newStatus: string
}) {
  return createTimelineEntry({
    ticketId: params.ticketId,
    type: 'STATUS_CHANGE',
    authorId: params.authorId,
    metadata: { oldStatus: params.oldStatus, newStatus: params.newStatus },
  })
}

export async function logAssignment(params: {
  ticketId: string
  authorId: string
  oldAssigneeId: string | null
  newAssigneeId: string | null
}) {
  return createTimelineEntry({
    ticketId: params.ticketId,
    type: 'ASSIGNMENT',
    authorId: params.authorId,
    metadata: {
      oldAssigneeId: params.oldAssigneeId,
      newAssigneeId: params.newAssigneeId,
    },
  })
}

export async function logReferenceAdded(params: {
  ticketId: string
  authorId: string
  referenceId: string
  title: string
  url: string
}) {
  return createTimelineEntry({
    ticketId: params.ticketId,
    type: 'REFERENCE_ADDED',
    authorId: params.authorId,
    metadata: {
      referenceId: params.referenceId,
      title: params.title,
      url: params.url,
    },
  })
}

export async function logWikiLinked(params: {
  ticketId: string
  authorId: string
  wikiPageId: string
  wikiPageTitle: string
  wikiPageSlug: string
}) {
  return createTimelineEntry({
    ticketId: params.ticketId,
    type: 'WIKI_LINKED',
    authorId: params.authorId,
    metadata: {
      wikiPageId: params.wikiPageId,
      title: params.wikiPageTitle,
      slug: params.wikiPageSlug,
    },
  })
}

export async function logGithubLinked(params: {
  ticketId: string
  authorId: string
  repoLinkId: string
  owner: string
  repo: string
  linkedBranch?: string | null
  linkedIssueNumber?: number | null
  linkedPullRequestNumber?: number | null
}) {
  return createTimelineEntry({
    ticketId: params.ticketId,
    type: 'GITHUB_LINKED',
    authorId: params.authorId,
    metadata: {
      repoLinkId: params.repoLinkId,
      owner: params.owner,
      repo: params.repo,
      linkedBranch: params.linkedBranch ?? null,
      linkedIssueNumber: params.linkedIssueNumber ?? null,
      linkedPullRequestNumber: params.linkedPullRequestNumber ?? null,
    },
  })
}

export async function logAgentRunStarted(params: {
  ticketId: string
  authorId: string
  agentRunId: string
  runType: string
  owner: string
  repo: string
}) {
  return createTimelineEntry({
    ticketId: params.ticketId,
    type: 'AGENT_RUN_STARTED',
    authorId: params.authorId,
    metadata: {
      agentRunId: params.agentRunId,
      runType: params.runType,
      owner: params.owner,
      repo: params.repo,
    },
  })
}

export async function logAgentRunCompleted(params: {
  ticketId: string
  agentRunId: string
  runType: string
  status: string
  owner: string
  repo: string
  outputSummary?: string | null
}) {
  return createTimelineEntry({
    ticketId: params.ticketId,
    type: 'AGENT_RUN_COMPLETED',
    metadata: {
      agentRunId: params.agentRunId,
      runType: params.runType,
      status: params.status,
      owner: params.owner,
      repo: params.repo,
      outputSummary: params.outputSummary ?? null,
    },
  })
}
