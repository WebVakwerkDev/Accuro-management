"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { DocScope } from "@prisma/client";
import { logger } from "@/lib/logger";

const CLIENT_DOCS_FOLDER_NAME = "__client_docs__";

const GENERAL_SETUP_DOCS = [
  {
    folderName: "Integraties",
    title: "n8n koppelen aan Agency OS",
    content: `Doel

Gebruik n8n om automatisch intakeformulieren, e-mails of andere triggers door te zetten naar Agency OS.

Aanpak

1. Maak in n8n een trigger aan.
Bijvoorbeeld:
- Webhook
- Gmail / IMAP trigger
- Typeform / Tally / website formulier

2. Voeg daarna een HTTP Request node toe.

Gebruik deze instellingen:
- Methode: POST
- URL: https://jouwdomein.nl/api/internal/projects
- Header: Authorization = Bearer JOUW_INTERNAL_API_KEY
- Header: Content-Type = application/json

3. Stuur een JSON body mee met klant, project en eventueel het eerste logitem.

Praktisch voorbeeld

\`\`\`json
{
  "client": {
    "companyName": "Acme B.V.",
    "contactName": "Jan Jansen",
    "email": "jan@acme.nl",
    "phone": "+31 6 12345678"
  },
  "project": {
    "name": "Nieuwe website Acme",
    "projectType": "NEW_WEBSITE",
    "status": "INTAKE",
    "priority": "MEDIUM",
    "description": "Klant wil een nieuwe website met duidelijke dienstenpagina's en een betere intakeflow."
  },
  "initialCommunication": {
    "type": "EMAIL",
    "subject": "Nieuwe aanvraag via formulier",
    "content": "Aanvraag automatisch doorgestuurd vanuit n8n."
  },
  "source": {
    "type": "n8n",
    "label": "Website intake"
  }
}
\`\`\`

Wat er gebeurt

- Bestaat de klant al, dan wordt die hergebruikt.
- Bestaat de klant nog niet, dan wordt die aangemaakt.
- Het project wordt aangemaakt in Agency OS.
- Het eerste logitem kan meteen worden opgeslagen.

Benodigd in .env

- INTERNAL_API_KEY=een lange geheime sleutel

Advies

- Laat n8n altijd een vaste source.label meesturen, zodat je later weet waar de intake vandaan kwam.
- Gebruik één centrale HTTP Request node als herbruikbare subflow voor alle nieuwe aanvragen.
- Test eerst met een losse webhook en voorbeeldpayload voordat je live formulieren koppelt.`,
  },
  {
    folderName: "Integraties",
    title: "Interne API gebruiken voor tickets en project-intake",
    content: `Endpoint

POST /api/internal/projects

Authenticatie

Gebruik een Bearer token via de Authorization header:

\`\`\`
Authorization: Bearer JOUW_INTERNAL_API_KEY
\`\`\`

Wat deze API doet

De endpoint maakt geen los supportticket-model aan, maar zet een intake direct om naar:
- een bestaande of nieuwe klant
- een project
- optioneel een eerste communicatie-item
- optioneel een eerste wijzigingsverzoek

Minimale payload

\`\`\`json
{
  "client": {
    "companyName": "Acme B.V.",
    "contactName": "Jan Jansen",
    "email": "jan@acme.nl"
  },
  "project": {
    "name": "Nieuwe intake Acme"
  }
}
\`\`\`

Veelgebruikte extra velden

- project.description
- project.scope
- project.priority
- initialCommunication.subject
- initialCommunication.content
- source.type
- source.label

Voorbeeld met bestaand klant-ID

\`\`\`json
{
  "clientId": "clx123...",
  "project": {
    "name": "Aanpassing offerteflow",
    "projectType": "OTHER",
    "status": "INTAKE",
    "priority": "HIGH"
  },
  "initialCommunication": {
    "type": "OTHER",
    "subject": "Nieuw intern ticket",
    "content": "Ingekomen via n8n of handmatige automatisering."
  },
  "source": {
    "type": "n8n",
    "label": "Interne intake"
  }
}
\`\`\`

Voorbeeld curl

\`\`\`bash
curl -X POST "https://jouwdomein.nl/api/internal/projects" \\
  -H "Authorization: Bearer JOUW_INTERNAL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client": {
      "companyName": "Acme B.V.",
      "contactName": "Jan Jansen",
      "email": "jan@acme.nl"
    },
    "project": {
      "name": "Nieuwe website Acme",
      "projectType": "NEW_WEBSITE",
      "status": "INTAKE",
      "priority": "MEDIUM"
    },
    "source": {
      "type": "n8n",
      "label": "Website formulier"
    }
  }'
\`\`\`

Response

Bij succes krijg je onder andere terug:
- client.id
- project.id
- project.slug

Gebruik in n8n

- Sla de response op
- Gebruik project.id of project.slug in vervolgstappen
- Voeg eventueel later nog een offerte- of communicatiestap toe

Let op

- Zonder geldige INTERNAL_API_KEY krijg je 401 Unauthorized.
- Bij verkeerde payload krijg je 422 Validation failed.
- Deze endpoint is bedoeld voor interne automatisering, niet voor publieke frontend-formulieren zonder extra afscherming.`,
  },
];

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
    for (const doc of GENERAL_SETUP_DOCS) {
      let folder = await prisma.docFolder.findFirst({
        where: {
          scope: DocScope.GENERAL,
          clientId: null,
          name: doc.folderName,
        },
      });

      if (!folder) {
        folder = await prisma.docFolder.create({
          data: {
            scope: DocScope.GENERAL,
            clientId: null,
            name: doc.folderName,
          },
        });
      }

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
    let folder = await prisma.docFolder.findFirst({
      where: {
        scope: DocScope.CLIENT,
        clientId: data.clientId,
        name: CLIENT_DOCS_FOLDER_NAME,
      },
    });

    if (!folder) {
      folder = await prisma.docFolder.create({
        data: {
          name: CLIENT_DOCS_FOLDER_NAME,
          scope: DocScope.CLIENT,
          clientId: data.clientId,
        },
      });
    }

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
