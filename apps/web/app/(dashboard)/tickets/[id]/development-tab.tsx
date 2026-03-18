/**
 * Development tab — server component.
 * Shows linked GitHub repositories, agent run history, and dev links for a ticket.
 */

import db from '@/lib/db'
import { formatDateTime } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING:   'bg-gray-100 text-gray-600',
    QUEUED:    'bg-blue-100 text-blue-700',
    RUNNING:   'bg-yellow-100 text-yellow-700',
    SUCCEEDED: 'bg-green-100 text-green-700',
    FAILED:    'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

function statusDot(status: string) {
  const map: Record<string, string> = {
    PENDING:   'bg-gray-400',
    QUEUED:    'bg-blue-500',
    RUNNING:   'bg-yellow-500 animate-pulse',
    SUCCEEDED: 'bg-green-500',
    FAILED:    'bg-red-500',
    CANCELLED: 'bg-gray-300',
  }
  return map[status] ?? 'bg-gray-400'
}

function runTypeLabel(runType: string) {
  const map: Record<string, string> = {
    PLAN:            'Generate Plan',
    CREATE_ISSUE:    'Create Issue',
    UPDATE_ISSUE:    'Update Issue',
    PREPARE_CHANGES: 'Prepare Changes',
    OPEN_PR_DRAFT:   'Open PR Draft',
    RUN_CODE_AGENT:  'Code Agent',
  }
  return map[runType] ?? runType
}

function githubRepoUrl(owner: string, repo: string) {
  return `https://github.com/${owner}/${repo}`
}

function githubBranchUrl(owner: string, repo: string, branch: string) {
  return `https://github.com/${owner}/${repo}/tree/${branch}`
}

function githubIssueUrl(owner: string, repo: string, issue: number) {
  return `https://github.com/${owner}/${repo}/issues/${issue}`
}

function githubPrUrl(owner: string, repo: string, pr: number) {
  return `https://github.com/${owner}/${repo}/pull/${pr}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default async function DevelopmentTab({ ticketId }: { ticketId: string }) {
  const [repoLinks, agentRuns] = await Promise.all([
    db.ticketRepositoryLink.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        githubConnection: true,
        createdBy: { select: { name: true } },
      },
    }),
    db.agentRun.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        startedBy: { select: { name: true } },
        repositoryLink: {
          select: {
            repoName: true,
            githubConnection: { select: { owner: true, repo: true } },
          },
        },
      },
    }),
  ])

  return (
    <div className="space-y-6">

      {/* ── Linked Repositories ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Linked Repositories</h3>
          <span className="text-xs text-gray-400">
            POST /api/v1/tickets/{ticketId}/repositories to link
          </span>
        </div>

        {repoLinks.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full mb-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No GitHub repository linked yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Use the API to link a registered repository to this ticket.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {repoLinks.map((link) => {
              const { owner, repo, defaultBranch } = link.githubConnection
              // For org-level connections (repo="*"), use repoName from the link
              const effectiveRepo = repo === '*' ? (link.repoName ?? '') : repo
              const isOrg = repo === '*'
              return (
                <div key={link.id} className="px-5 py-4">
                  {/* Repo header */}
                  <div className="flex items-start gap-3">
                    <svg className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={effectiveRepo ? githubRepoUrl(owner, effectiveRepo) : `https://github.com/${owner}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-blue-600 hover:underline"
                        >
                          {effectiveRepo ? `${owner}/${effectiveRepo}` : owner}
                        </a>
                        {isOrg && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            org-token
                          </span>
                        )}
                        {!isOrg && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {defaultBranch}
                          </span>
                        )}
                      </div>

                      {/* Dev links */}
                      <div className="mt-2 flex flex-wrap gap-3">
                        {link.linkedBranch && effectiveRepo && (
                          <a
                            href={githubBranchUrl(owner, effectiveRepo, link.linkedBranch)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600"
                          >
                            <span className="text-gray-400">branch:</span>
                            <span className="font-mono">{link.linkedBranch}</span>
                          </a>
                        )}
                        {link.linkedIssueNumber && effectiveRepo && (
                          <a
                            href={githubIssueUrl(owner, effectiveRepo, link.linkedIssueNumber)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600"
                          >
                            <span className="text-gray-400">issue:</span>
                            <span>#{link.linkedIssueNumber}</span>
                          </a>
                        )}
                        {link.linkedPullRequestNumber && effectiveRepo && (
                          <a
                            href={githubPrUrl(owner, effectiveRepo, link.linkedPullRequestNumber)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600"
                          >
                            <span className="text-gray-400">PR:</span>
                            <span>#{link.linkedPullRequestNumber}</span>
                          </a>
                        )}
                        {link.environmentUrl && (
                          <a
                            href={link.environmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600"
                          >
                            <span className="text-gray-400">preview:</span>
                            <span>open</span>
                          </a>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mt-1.5">
                        Linked by {link.createdBy.name} on {formatDateTime(link.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Agent Actions info ───────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-1">Agent Actions</h4>
        <p className="text-xs text-blue-700 mb-3">
          Trigger agent runs via the API. Available run types:
        </p>
        <div className="flex flex-wrap gap-2">
          {['PLAN', 'CREATE_ISSUE', 'UPDATE_ISSUE', 'PREPARE_CHANGES', 'OPEN_PR_DRAFT', 'RUN_CODE_AGENT'].map((t) => (
            <span key={t} className="text-xs font-mono bg-white border border-blue-200 text-blue-800 px-2 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
        <p className="text-xs text-blue-600 mt-3 font-mono">
          POST /api/v1/tickets/{ticketId}/agent-runs
        </p>
      </div>

      {/* ── Recent Agent Runs ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            Agent Runs
            <span className="text-gray-400 font-normal ml-1.5">({agentRuns.length})</span>
          </h3>
        </div>

        {agentRuns.length === 0 ? (
          <p className="text-sm text-gray-400 px-5 py-6 text-center">No agent runs yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {agentRuns.map((run) => {
              const { owner, repo } = run.repositoryLink.githubConnection
              const effectiveRunRepo = repo === '*'
                ? (run.repositoryLink.repoName ?? '')
                : repo
              const outputData = run.outputData as Record<string, unknown> | null
              return (
                <div key={run.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${statusDot(run.status)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">
                          {runTypeLabel(run.runType)}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(run.status)}`}>
                          {run.status}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {effectiveRunRepo ? `${owner}/${effectiveRunRepo}` : owner}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span>by {run.startedBy.name}</span>
                        <span>{formatDateTime(run.createdAt)}</span>
                        {run.completedAt && (
                          <span>completed {formatDateTime(run.completedAt)}</span>
                        )}
                      </div>

                      {run.outputSummary && (
                        <p className="mt-2 text-sm text-gray-700 bg-gray-50 rounded px-3 py-2">
                          {run.outputSummary}
                        </p>
                      )}

                      {/* Structured output links */}
                      {outputData && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {typeof outputData.issueUrl === 'string' && (
                            <a href={outputData.issueUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline">
                              View Issue
                            </a>
                          )}
                          {typeof outputData.prUrl === 'string' && (
                            <a href={outputData.prUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline">
                              View PR
                            </a>
                          )}
                          {typeof outputData.commitUrl === 'string' && (
                            <a href={outputData.commitUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline">
                              View Commit
                            </a>
                          )}
                        </div>
                      )}

                      {run.errorMessage && (
                        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-3 py-1.5">
                          {run.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
