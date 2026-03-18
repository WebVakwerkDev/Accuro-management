"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { AgentRunStatus } from "@prisma/client";

export async function getAgentRuns(projectId: string) {
  try {
    const agentRuns = await prisma.agentRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        initiatedBy: {
          select: { id: true, name: true },
        },
        changeRequest: {
          select: { id: true, title: true },
        },
      },
    });

    return { success: true, agentRuns };
  } catch (error) {
    console.error("getAgentRuns error:", error);
    return { success: false, error: "Failed to fetch agent runs" };
  }
}

export async function generateDeveloperBriefing(
  projectId: string,
  changeRequestId: string | null,
  actorUserId: string
): Promise<{
  success: boolean;
  briefing?: string;
  agentRunId?: string;
  error?: string;
}> {
  try {
    const project = await prisma.projectWorkspace.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { companyName: true } },
        repositories: true,
      },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    let changeRequest = null;
    if (changeRequestId) {
      changeRequest = await prisma.changeRequest.findUnique({
        where: { id: changeRequestId },
        select: {
          title: true,
          description: true,
          impact: true,
          sourceType: true,
        },
      });
    }

    const primaryRepo = project.repositories[0];

    // Build acceptance criteria from change request description
    let acceptanceCriteria = "- [ ] Feature implemented as described\n- [ ] No regressions introduced\n- [ ] Code is clean and documented";
    if (changeRequest) {
      const descLines = changeRequest.description
        .split(/[.!?]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10)
        .slice(0, 5);

      if (descLines.length > 0) {
        acceptanceCriteria = descLines
          .map((line) => `- [ ] ${line}`)
          .join("\n");
      }
    }

    // Derive risks from impact level
    let risks = "- [ ] Unexpected side effects\n- [ ] Performance regression";
    if (changeRequest) {
      if (changeRequest.impact === "LARGE") {
        risks =
          "- Breaking changes may affect other parts of the codebase\n- Performance impact under load needs validation\n- Client-facing functionality requires thorough QA";
      } else if (changeRequest.impact === "MEDIUM") {
        risks =
          "- Adjacent features may be affected\n- Requires cross-browser testing\n- Regression testing recommended";
      } else {
        risks =
          "- Minimal risk expected\n- Verify no unintended side effects\n- Test on mobile devices";
      }
    }

    // Tech stack specific notes
    let techNotes = "Follow project coding standards and conventions.";
    if (project.techStack) {
      const stack = project.techStack.toLowerCase();
      const notes: string[] = [];
      if (stack.includes("next") || stack.includes("react")) {
        notes.push("Use React Server Components where possible.");
        notes.push("Ensure proper client/server boundary separation.");
      }
      if (stack.includes("prisma")) {
        notes.push("Run Prisma migrations if schema changes are required.");
      }
      if (stack.includes("typescript") || stack.includes("ts")) {
        notes.push("Maintain strict TypeScript types — no `any`.");
      }
      if (stack.includes("tailwind")) {
        notes.push("Use Tailwind utility classes; avoid custom CSS unless necessary.");
      }
      if (notes.length > 0) {
        techNotes = notes.join("\n");
      }
    }

    const briefing = `# Developer Briefing

## Project Context
- **Project**: ${project.name}
- **Client**: ${project.client.companyName}
- **Status**: ${project.status}
- **Tech Stack**: ${project.techStack ?? "Not specified"}
- **Domain**: ${project.domainName ?? "Not specified"}
- **Hosting**: ${project.hostingInfo ?? "Not specified"}
- **Repository**: ${primaryRepo?.repoUrl ?? "No repository linked"}
- **Default Branch**: ${primaryRepo?.defaultBranch ?? "Not specified"}

${
  changeRequest
    ? `## Change Request
- **Title**: ${changeRequest.title}
- **Description**: ${changeRequest.description}
- **Impact**: ${changeRequest.impact}
- **Source**: ${changeRequest.sourceType}

## Requested Change
${changeRequest.description}`
    : "## Requested Change\n_No specific change request linked. Refer to project scope and description._"
}

## Acceptance Criteria
${acceptanceCriteria}

## Technical Notes
${techNotes}

## Repository Context
- Repo: ${primaryRepo?.repoUrl ?? "N/A"}
- Branch: ${primaryRepo?.defaultBranch ?? "N/A"}
- Issues: ${primaryRepo?.issueBoardUrl ?? "N/A"}

## Risks
${risks}

## Review Checklist
- [ ] Code reviewed
- [ ] Tested on mobile
- [ ] Cross-browser tested
- [ ] Client approved
`;

    // Save the agent run
    const agentRun = await prisma.agentRun.create({
      data: {
        projectId,
        changeRequestId: changeRequestId ?? null,
        initiatedByUserId: actorUserId,
        promptSnapshot: briefing,
        status: AgentRunStatus.COMPLETED,
        
      },
    });

    await createAuditLog({
      actorUserId,
      entityType: "AgentRun",
      entityId: agentRun.id,
      action: "GENERATE_BRIEFING",
      metadata: {
        projectId,
        changeRequestId,
        projectName: project.name,
      },
    });

    return { success: true, briefing, agentRunId: agentRun.id };
  } catch (error) {
    console.error("generateDeveloperBriefing error:", error);
    return { success: false, error: "Failed to generate developer briefing" };
  }
}

export async function saveAgentRun(data: {
  projectId: string;
  changeRequestId?: string;
  promptSnapshot: string;
  actorUserId: string;
}): Promise<{ success: boolean; agentRunId?: string; error?: string }> {
  try {
    const agentRun = await prisma.agentRun.create({
      data: {
        projectId: data.projectId,
        changeRequestId: data.changeRequestId ?? null,
        initiatedByUserId: data.actorUserId,
        promptSnapshot: data.promptSnapshot,
        status: AgentRunStatus.COMPLETED,
        
      },
    });

    await createAuditLog({
      actorUserId: data.actorUserId,
      entityType: "AgentRun",
      entityId: agentRun.id,
      action: "SAVE",
      metadata: {
        projectId: data.projectId,
        changeRequestId: data.changeRequestId,
      },
    });

    return { success: true, agentRunId: agentRun.id };
  } catch (error) {
    console.error("saveAgentRun error:", error);
    return { success: false, error: "Failed to save agent run" };
  }
}
