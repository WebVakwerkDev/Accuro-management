"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { DocScope } from "@prisma/client";
import { logger } from "@/lib/logger";
import { loadGeneralDocsContent } from "@/lib/content";

const CLIENT_DOCS_FOLDER_NAME = "__client_docs__";

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
    logger.error("Failed to fetch doc folders", error, { scope, clientId });
    return { success: false, error: "Docs ophalen mislukt." };
  }
}

export async function ensureGeneralDocs() {
  try {
    const docs = await loadGeneralDocsContent();

    for (const doc of docs) {
      const folder = await getOrCreateDocFolder({
        scope: DocScope.GENERAL,
        name: doc.folder,
      });

      const existing = await prisma.docEntry.findFirst({
        where: {
          folderId: folder.id,
          title: doc.title,
        },
      });

      if (!existing) {
        await prisma.docEntry.create({
          data: {
            folderId: folder.id,
            title: doc.title,
            content: doc.content,
          },
        });
        continue;
      }

      if (existing.content !== doc.content) {
        await prisma.docEntry.update({
          where: { id: existing.id },
          data: { content: doc.content },
        });
      }
    }

    return { success: true };
  } catch (error) {
    logger.error("Failed to ensure general docs", error);
    return { success: false, error: "Standaarddocs konden niet worden bijgewerkt." };
  }
}

export async function getClientDocs(clientId: string) {
  try {
    const docs = await prisma.docEntry.findMany({
      where: {
        folder: {
          scope: DocScope.CLIENT,
          clientId,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true,
        folderId: true,
      },
    });

    return { success: true, docs };
  } catch (error) {
    logger.error("Failed to fetch client docs", error, { clientId });
    return { success: false, error: "Klantdocs ophalen mislukt." };
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
    logger.error("Failed to create doc folder", error, {
      scope: data.scope,
      clientId: data.clientId,
    });
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
    logger.error("Failed to create doc entry", error, { folderId: data.folderId });
    return { success: false, error: "Document aanmaken mislukt." };
  }
}

export async function createClientDoc(data: {
  clientId: string;
  title: string;
  content: string;
  actorUserId: string;
}) {
  try {
    const folder = await getOrCreateDocFolder({
      scope: DocScope.CLIENT,
      clientId: data.clientId,
      name: CLIENT_DOCS_FOLDER_NAME,
    });

    const entry = await prisma.docEntry.create({
      data: {
        folderId: folder.id,
        title: data.title,
        content: data.content,
      },
    });

    await createAuditLog({
      actorUserId: data.actorUserId,
      entityType: "DocEntry",
      entityId: entry.id,
      action: "CREATE",
      metadata: { clientId: data.clientId, title: data.title, folderId: folder.id },
    });

    return { success: true, entry };
  } catch (error) {
    logger.error("Failed to create client doc", error, { clientId: data.clientId });
    return { success: false, error: "Klantdocument aanmaken mislukt." };
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
    logger.error("Failed to update doc entry", error, { docId: data.id });
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
    logger.error("Failed to delete doc entry", error, { docId: id });
    return { success: false, error: "Document verwijderen mislukt." };
  }
}

async function getOrCreateDocFolder(data: {
  scope: DocScope;
  name: string;
  clientId?: string;
}) {
  const folder = await prisma.docFolder.findFirst({
    where: {
      scope: data.scope,
      clientId: data.scope === DocScope.CLIENT ? data.clientId ?? null : null,
      name: data.name,
    },
  });

  if (folder) {
    return folder;
  }

  return prisma.docFolder.create({
    data: {
      scope: data.scope,
      clientId: data.scope === DocScope.CLIENT ? data.clientId ?? null : null,
      name: data.name,
    },
  });
}
