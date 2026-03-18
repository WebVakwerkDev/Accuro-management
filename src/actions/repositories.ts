"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function getRepositories(projectId: string) {
  try {
    const repositories = await prisma.projectRepository.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, repositories };
  } catch (error) {
    console.error("getRepositories error:", error);
    return { success: false, error: "Failed to fetch repositories" };
  }
}

export async function addRepository(
  projectId: string,
  data: {
    repoName: string;
    repoUrl: string;
    defaultBranch: string;
    issueBoardUrl?: string;
  },
  actorUserId: string
) {
  try {
    const repository = await prisma.projectRepository.create({
      data: {
        projectId,
        repoName: data.repoName,
        repoUrl: data.repoUrl,
        defaultBranch: data.defaultBranch,
        issueBoardUrl: data.issueBoardUrl ?? null,
      },
    });

    await createAuditLog({
      actorUserId,
      entityType: "Repository",
      entityId: repository.id,
      action: "CREATE",
      metadata: {
        projectId,
        repoName: data.repoName,
        repoUrl: data.repoUrl,
      },
    });

    return { success: true, repository };
  } catch (error) {
    console.error("addRepository error:", error);
    return { success: false, error: "Failed to add repository" };
  }
}

export async function deleteRepository(
  id: string,
  projectId: string,
  actorUserId: string
) {
  try {
    const repository = await prisma.projectRepository.findUnique({
      where: { id },
    });

    if (!repository) {
      return { success: false, error: "Repository not found" };
    }

    if (repository.projectId !== projectId) {
      return {
        success: false,
        error: "Repository does not belong to the specified project",
      };
    }

    await prisma.projectRepository.delete({ where: { id } });

    await createAuditLog({
      actorUserId,
      entityType: "Repository",
      entityId: id,
      action: "DELETE",
      metadata: {
        projectId,
        repoName: repository.repoName,
        repoUrl: repository.repoUrl,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("deleteRepository error:", error);
    return { success: false, error: "Failed to delete repository" };
  }
}
