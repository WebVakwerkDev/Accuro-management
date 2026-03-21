"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { AgentRunStatus } from "@prisma/client";
import {
  getRepositoryInfo,
  checkCopilotAgent,
  createIssue,
  addIssueAssignees,
  parseOwnerRepo,
  GitHubApiError,
} from "@/services/githubService";

// ─── Get repository info for a project ───────────────────────────────────────

export async function getProjectRepoInfo(projectId: string, repositoryId: string) {
  try {
    const repoContext = await getProjectRepositoryContext(projectId, repositoryId);
    if (!repoContext) {
      return { success: false as const, error: "Repository not found" };
    }

    const info = await getRepositoryInfo(repoContext.owner, repoContext.repoName);

    return { success: true as const, info };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { success: false as const, error: error.message, rateLimited: error.rateLimited };
    }
    logger.error("getProjectRepoInfo error:", error);
    return { success: false as const, error: "Failed to fetch repository info" };
  }
}

// ─── Check Copilot agent availability ─────────────────────────────────────────

export async function checkProjectCopilotAgent(
  projectId: string,
  repositoryId: string,
  actorUserId: string,
) {
  try {
    const repoContext = await getProjectRepositoryContext(projectId, repositoryId);
    if (!repoContext) {
      return { success: false as const, error: "Repository not found" };
    }

    const result = await checkCopilotAgent(repoContext.owner, repoContext.repoName);

    await createAuditLog({
      actorUserId,
      entityType: "ProjectRepository",
      entityId: repositoryId,
      action: "COPILOT_AGENT_CHECKED",
      metadata: {
        projectId,
        repoName: repoContext.repository.repoName,
        available: result.available,
      },
    });

    return { success: true as const, copilot: result };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { success: false as const, error: error.message, rateLimited: error.rateLimited };
    }
    logger.error("checkProjectCopilotAgent error:", error);
    return { success: false as const, error: "Failed to check Copilot agent" };
  }
}

// ─── Prompt GitHub Copilot agent ──────────────────────────────────────────────

export async function promptGithubAgent(
  projectId: string,
  repositoryId: string,
  prompt: string,
  actorUserId: string,
) {
  try {
    if (!prompt.trim()) {
      return { success: false as const, error: "Prompt is verplicht" };
    }

    const [repoContext, project] = await Promise.all([
      getProjectRepositoryContext(projectId, repositoryId),
      prisma.projectWorkspace.findUnique({
        where: { id: projectId },
        select: { name: true, techStack: true, description: true },
      }),
    ]);

    if (!repoContext) {
      return { success: false as const, error: "Repository niet gevonden" };
    }
    if (!project) {
      return { success: false as const, error: "Project niet gevonden" };
    }

    // Check Copilot availability to get the actual bot login
    const copilot = await checkCopilotAgent(repoContext.owner, repoContext.repoName);

    const bodyParts = [
      prompt.trim(),
      "",
      "---",
      `**Project:** ${project.name}`,
    ];
    if (project.techStack) {
      bodyParts.push(`**Tech Stack:** ${project.techStack}`);
    }
    if (project.description) {
      bodyParts.push(`**Context:** ${project.description}`);
    }

    const title = prompt.trim().split("\n")[0].slice(0, 100);

    // Create issue without assignees (GitHub silently ignores bot assignees on creation)
    const issue = await createIssue(repoContext.owner, repoContext.repoName, {
      title,
      body: bodyParts.join("\n"),
    });

    let copilotAssigned = false;
    if (copilot.available && copilot.login) {
      try {
        await addIssueAssignees(repoContext.owner, repoContext.repoName, issue.number, [copilot.login]);
        copilotAssigned = true;
      } catch (assignError) {
        logger.warn("Could not assign Copilot agent — insufficient token permissions", {
          issueUrl: issue.url,
          login: copilot.login,
          error: assignError instanceof GitHubApiError ? assignError.message : String(assignError),
        });
      }
    }

    const agentRun = await prisma.agentRun.create({
      data: {
        projectId,
        initiatedByUserId: actorUserId,
        promptSnapshot: prompt.trim(),
        status: AgentRunStatus.RUNNING,
        githubIssueUrl: issue.url,
      },
    });

    await createAuditLog({
      actorUserId,
      entityType: "AgentRun",
      entityId: agentRun.id,
      action: "GITHUB_AGENT_PROMPTED",
      metadata: { projectId, repositoryId, issueUrl: issue.url, issueNumber: issue.number },
    });

    return { success: true as const, issue, agentRunId: agentRun.id, copilotAssigned };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { success: false as const, error: error.message, rateLimited: error.rateLimited };
    }
    logger.error("promptGithubAgent error:", error);
    return { success: false as const, error: "Agent prompt versturen mislukt" };
  }
}

// ─── Create GitHub issue from change request ──────────────────────────────────

export async function createIssueFromChangeRequest(
  projectId: string,
  changeRequestId: string,
  repositoryId: string,
  actorUserId: string,
) {
  try {
    // Load change request + project + repo in parallel
    const [changeRequest, repo, project] = await Promise.all([
      prisma.changeRequest.findUnique({ where: { id: changeRequestId } }),
      getProjectRepositoryContext(projectId, repositoryId),
      prisma.projectWorkspace.findUnique({
        where: { id: projectId },
        select: { name: true, techStack: true },
      }),
    ]);

    if (!changeRequest || changeRequest.projectId !== projectId) {
      return { success: false as const, error: "Change request not found" };
    }
    if (!repo) {
      return { success: false as const, error: "Repository not found" };
    }
    if (changeRequest.githubIssueUrl) {
      return { success: false as const, error: "Issue already created for this change request" };
    }

    // Build issue body
    const sections = [
      `## Change Request`,
      changeRequest.description,
      "",
      `**Impact:** ${changeRequest.impact}`,
      `**Source:** ${changeRequest.sourceType}`,
    ];
    if (project?.techStack) {
      sections.push("", `**Tech Stack:** ${project.techStack}`);
    }
    sections.push("", `---`, `*Created from project: ${project?.name ?? projectId}*`);

    const issue = await createIssue(repo.owner, repo.repoName, {
      title: changeRequest.title,
      body: sections.join("\n"),
    });

    // Store issue URL on the change request
    await prisma.changeRequest.update({
      where: { id: changeRequestId },
      data: { githubIssueUrl: issue.url },
    });

    await createAuditLog({
      actorUserId,
      entityType: "ChangeRequest",
      entityId: changeRequestId,
      action: "GITHUB_ISSUE_CREATED",
      metadata: {
        projectId,
        issueNumber: issue.number,
        issueUrl: issue.url,
        repoName: repo.repository.repoName,
      },
    });

    return { success: true as const, issue };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { success: false as const, error: error.message, rateLimited: error.rateLimited };
    }
    logger.error("createIssueFromChangeRequest error:", error);
    return { success: false as const, error: "Failed to create GitHub issue" };
  }
}

async function getProjectRepositoryContext(projectId: string, repositoryId: string) {
  const repository = await prisma.projectRepository.findUnique({
    where: { id: repositoryId },
  });

  if (!repository || repository.projectId !== projectId) {
    return null;
  }

  const { owner, repo } = parseOwnerRepo(repository.repoName);

  return {
    repository,
    owner,
    repoName: repo,
  };
}
