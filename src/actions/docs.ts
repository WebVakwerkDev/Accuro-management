"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { DocScope } from "@prisma/client";

export async function getDocFolders(scope: DocScope, clientId?: string) {
  try {
    const folders = await prisma.docFolder.findMany({
      where: {
        scope,
        ...(scope === "CLIENT" ? { clientId } : { clientId: null }),
      },
      orderBy: { name: "asc" },
      include: {
        docs: {
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    return { success: true, folders };
  } catch (error) {
    console.error("getDocFolders error:", error);
    return { success: false, error: "Docs ophalen mislukt." };
  }
}

export async function createDocFolder(data: {
  name: string;
  scope: DocScope;
  clientId?: string;
  actorUserId: string;
}) {
  try {
    const folder = await prisma.docFolder.create({
      data: {
        name: data.name,
        scope: data.scope,
        clientId: data.scope === "CLIENT" ? data.clientId ?? null : null,
      },
    });

    await createAuditLog({
      actorUserId: data.actorUserId,
      entityType: "DocFolder",
      entityId: folder.id,
      action: "CREATE",
      metadata: {
        scope: folder.scope,
        clientId: folder.clientId,
        name: folder.name,
      },
    });

    return { success: true, folder };
  } catch (error) {
    console.error("createDocFolder error:", error);
    return { success: false, error: "Map aanmaken mislukt." };
  }
}

export async function createDocEntry(data: {
  folderId: string;
  title: string;
  content: string;
  actorUserId: string;
}) {
  try {
    const entry = await prisma.docEntry.create({
      data: {
        folderId: data.folderId,
        title: data.title,
        content: data.content,
      },
    });

    await createAuditLog({
      actorUserId: data.actorUserId,
      entityType: "DocEntry",
      entityId: entry.id,
      action: "CREATE",
      metadata: { folderId: data.folderId, title: data.title },
    });

    return { success: true, entry };
  } catch (error) {
    console.error("createDocEntry error:", error);
    return { success: false, error: "Document aanmaken mislukt." };
  }
}

export async function updateDocEntry(data: {
  id: string;
  title: string;
  content: string;
  actorUserId: string;
}) {
  try {
    const entry = await prisma.docEntry.update({
      where: { id: data.id },
      data: {
        title: data.title,
        content: data.content,
      },
    });

    await createAuditLog({
      actorUserId: data.actorUserId,
      entityType: "DocEntry",
      entityId: entry.id,
      action: "UPDATE",
      metadata: { title: data.title },
    });

    return { success: true, entry };
  } catch (error) {
    console.error("updateDocEntry error:", error);
    return { success: false, error: "Document opslaan mislukt." };
  }
}

export async function deleteDocEntry(id: string, actorUserId: string) {
  try {
    const existing = await prisma.docEntry.findUnique({
      where: { id },
      select: { id: true, title: true, folderId: true },
    });

    if (!existing) {
      return { success: false, error: "Document niet gevonden." };
    }

    await prisma.docEntry.delete({ where: { id } });

    await createAuditLog({
      actorUserId,
      entityType: "DocEntry",
      entityId: id,
      action: "DELETE",
      metadata: { folderId: existing.folderId, title: existing.title },
    });

    return { success: true };
  } catch (error) {
    console.error("deleteDocEntry error:", error);
    return { success: false, error: "Document verwijderen mislukt." };
  }
}
