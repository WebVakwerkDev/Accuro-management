"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import {
  ChangeRequestFormSchema,
  type ChangeRequestFormData,
} from "@/lib/validations/change-request";
import { ChangeRequestStatus } from "@prisma/client";

export async function getChangeRequests(projectId: string) {
  try {
    const changeRequests = await prisma.changeRequest.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        assignedTo: {
          select: { id: true, name: true },
        },
      },
    });

    return { success: true, changeRequests };
  } catch (error) {
    console.error("getChangeRequests error:", error);
    return { success: false, error: "Failed to fetch change requests" };
  }
}

export async function getChangeRequest(id: string) {
  try {
    const changeRequest = await prisma.changeRequest.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        agentRuns: {
          orderBy: { createdAt: "desc" },
          include: {
            initiatedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!changeRequest) {
      return { success: false, error: "Change request not found" };
    }

    return { success: true, changeRequest };
  } catch (error) {
    console.error("getChangeRequest error:", error);
    return { success: false, error: "Failed to fetch change request" };
  }
}

export async function createChangeRequest(
  data: ChangeRequestFormData,
  actorUserId: string
) {
  try {
    const validated = ChangeRequestFormSchema.parse(data);

    const changeRequest = await prisma.changeRequest.create({
      data: {
        projectId: validated.projectId,
        createdByUserId: actorUserId,
        title: validated.title,
        description: validated.description,
        sourceType: validated.sourceType,
        status: validated.status,
        impact: validated.impact,
        githubIssueUrl: validated.githubIssueUrl || null,
        githubBranch: validated.githubBranch ?? null,
        githubPrUrl: validated.githubPrUrl || null,
        assignedToUserId: validated.assignedToUserId ?? null,
      },
    });

    await createAuditLog({
      actorUserId,
      entityType: "ChangeRequest",
      entityId: changeRequest.id,
      action: "CREATE",
      metadata: {
        projectId: validated.projectId,
        title: validated.title,
        impact: validated.impact,
      },
    });

    return { success: true, changeRequest };
  } catch (error) {
    console.error("createChangeRequest error:", error);
    return { success: false, error: "Failed to create change request" };
  }
}

export async function updateChangeRequest(
  id: string,
  data: Partial<ChangeRequestFormData & { status: ChangeRequestStatus }>,
  actorUserId: string
) {
  try {
    const existing = await prisma.changeRequest.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Change request not found" };
    }

    const changeRequest = await prisma.changeRequest.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.sourceType !== undefined ? { sourceType: data.sourceType } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.impact !== undefined ? { impact: data.impact } : {}),
        ...(data.githubIssueUrl !== undefined
          ? { githubIssueUrl: data.githubIssueUrl || null }
          : {}),
        ...(data.githubBranch !== undefined
          ? { githubBranch: data.githubBranch ?? null }
          : {}),
        ...(data.githubPrUrl !== undefined
          ? { githubPrUrl: data.githubPrUrl || null }
          : {}),
        ...(data.assignedToUserId !== undefined
          ? { assignedToUserId: data.assignedToUserId ?? null }
          : {}),
      },
    });

    if (data.status && data.status !== existing.status) {
      await createAuditLog({
        actorUserId,
        entityType: "ChangeRequest",
        entityId: id,
        action: "STATUS_CHANGE",
        metadata: {
          from: existing.status,
          to: data.status,
          title: changeRequest.title,
        },
      });
    } else {
      await createAuditLog({
        actorUserId,
        entityType: "ChangeRequest",
        entityId: id,
        action: "UPDATE",
        metadata: { title: changeRequest.title },
      });
    }

    return { success: true, changeRequest };
  } catch (error) {
    console.error("updateChangeRequest error:", error);
    return { success: false, error: "Failed to update change request" };
  }
}

export async function reopenChangeRequest(id: string, actorUserId: string) {
  try {
    const existing = await prisma.changeRequest.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Change request not found" };
    }

    const changeRequest = await prisma.changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.NEW,
        reopenedCount: { increment: 1 },
        closedAt: null,
      },
    });

    await createAuditLog({
      actorUserId,
      entityType: "ChangeRequest",
      entityId: id,
      action: "REOPEN",
      metadata: {
        previousStatus: existing.status,
        reopenedCount: changeRequest.reopenedCount,
        title: changeRequest.title,
      },
    });

    return { success: true, changeRequest };
  } catch (error) {
    console.error("reopenChangeRequest error:", error);
    return { success: false, error: "Failed to reopen change request" };
  }
}

export async function closeChangeRequest(id: string, actorUserId: string) {
  try {
    const existing = await prisma.changeRequest.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Change request not found" };
    }

    const changeRequest = await prisma.changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.DONE,
        closedAt: new Date(),
      },
    });

    await createAuditLog({
      actorUserId,
      entityType: "ChangeRequest",
      entityId: id,
      action: "CLOSE",
      metadata: {
        previousStatus: existing.status,
        title: changeRequest.title,
      },
    });

    return { success: true, changeRequest };
  } catch (error) {
    console.error("closeChangeRequest error:", error);
    return { success: false, error: "Failed to close change request" };
  }
}
