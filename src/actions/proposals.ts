"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function getProposalDrafts(projectId: string) {
  try {
    const proposals = await prisma.proposalDraft.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: { id: true, companyName: true, contactName: true, email: true, address: true },
        },
      },
    });

    return { success: true, proposals };
  } catch (error) {
    console.error("getProposalDrafts error:", error);
    return { success: false, error: "Offerteconcepten ophalen mislukt." };
  }
}

export async function createProposalDraft(data: {
  actorUserId: string;
  clientId: string;
  projectId?: string;
  title: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientCompany?: string;
  recipientAddress?: string;
  summary: string;
  scope?: string;
  priceLabel?: string;
  amount?: number;
  deliveryTime?: string;
  notes?: string;
}) {
  try {
    const proposal = await prisma.proposalDraft.create({
      data: {
        clientId: data.clientId,
        projectId: data.projectId ?? null,
        title: data.title,
        recipientName: data.recipientName ?? null,
        recipientEmail: data.recipientEmail ?? null,
        recipientCompany: data.recipientCompany ?? null,
        recipientAddress: data.recipientAddress ?? null,
        summary: data.summary,
        scope: data.scope ?? null,
        priceLabel: data.priceLabel ?? null,
        amount: data.amount ?? null,
        deliveryTime: data.deliveryTime ?? null,
        notes: data.notes ?? null,
      },
    });

    await createAuditLog({
      actorUserId: data.actorUserId,
      entityType: "ProposalDraft",
      entityId: proposal.id,
      action: "CREATE",
      metadata: {
        clientId: data.clientId,
        projectId: data.projectId,
        title: data.title,
      },
    });

    return { success: true, proposal };
  } catch (error) {
    console.error("createProposalDraft error:", error);
    return { success: false, error: "Offerteconcept aanmaken mislukt." };
  }
}
