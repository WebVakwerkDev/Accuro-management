import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const BUSINESS_SETTINGS_ID = "singleton";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "Niet ingelogd" },
      { status: 401 },
    );
  }

  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { success: false, error: "Geen toegang" },
      { status: 403 },
    );
  }

  try {
    const [
      users,
      clients,
      projects,
      communicationEntries,
      changeRequests,
      internalNotes,
      repositories,
      agentRuns,
      invoices,
      proposalDrafts,
      docFolders,
      docEntries,
      businessSettings,
      auditLogs,
    ] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.client.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.projectWorkspace.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.communicationEntry.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.changeRequest.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.internalNote.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.projectRepository.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.agentRun.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.proposalDraft.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.docFolder.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.docEntry.findMany({
        orderBy: { createdAt: "asc" },
      }),
      prisma.businessSettings.findUnique({
        where: { id: BUSINESS_SETTINGS_ID },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const exportedAt = new Date();
    const payload = serializeForExport({
      meta: {
        formatVersion: 1,
        exportedAt,
        exportedBy: {
          id: session.user.id,
          email: session.user.email,
        },
        counts: {
          users: users.length,
          clients: clients.length,
          projects: projects.length,
          communicationEntries: communicationEntries.length,
          changeRequests: changeRequests.length,
          internalNotes: internalNotes.length,
          repositories: repositories.length,
          agentRuns: agentRuns.length,
          invoices: invoices.length,
          proposalDrafts: proposalDrafts.length,
          docFolders: docFolders.length,
          docEntries: docEntries.length,
          auditLogs: auditLogs.length,
        },
      },
      data: {
        users,
        clients,
        projects,
        communicationEntries,
        changeRequests,
        internalNotes,
        repositories,
        agentRuns,
        invoices,
        proposalDrafts,
        docFolders,
        docEntries,
        businessSettings,
        auditLogs,
      },
    });

    await createAuditLog({
      actorUserId: session.user.id,
      entityType: "System",
      entityId: "data-export",
      action: "EXPORT",
      metadata: {
        exportedAt: exportedAt.toISOString(),
        formatVersion: 1,
      },
    });

    const filename = `agency-os-export-${exportedAt.toISOString().slice(0, 10)}.json`;

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("Data export failed", error, {
      actorUserId: session.user.id,
    });

    return NextResponse.json(
      { success: false, error: "Data export mislukt" },
      { status: 500 },
    );
  }
}

function serializeForExport(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Prisma.Decimal.isDecimal(value)) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeForExport(entry));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        serializeForExport(entryValue),
      ]),
    );
  }

  return value;
}
