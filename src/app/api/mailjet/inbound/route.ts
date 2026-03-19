import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { EmailFolder, EmailDirection } from "@prisma/client";
import { parseAddressField, parseAddressList } from "@/lib/mailjet";
import { getMailjetInboundSecret } from "@/lib/env";

// POST /api/mailjet/inbound?secret=<MAILJET_INBOUND_SECRET>
// Called by Mailjet Parse API when an email arrives on your domain.
// Mailjet sends multipart/form-data.
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expectedSecret = getMailjetInboundSecret();

  if (!expectedSecret || secret !== expectedSecret) {
    logger.warn("Rejected Mailjet inbound request — invalid secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    logger.error("Failed to parse Mailjet inbound form data", err);
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const fromRaw = (formData.get("From") as string) ?? "";
  const toRaw = (formData.get("To") as string) ?? "";
  const ccRaw = (formData.get("Cc") as string) ?? "";
  const subject = (formData.get("Subject") as string) || "(geen onderwerp)";
  const bodyText = (formData.get("Text-part") as string) || null;
  const bodyHtml = (formData.get("Html-part") as string) || null;
  const messageId = (formData.get("MessageID") as string) || null;
  const dateRaw = (formData.get("Date") as string) || null;
  const nbAttachments = parseInt((formData.get("Nb-attachments") as string) || "0", 10);

  const { name: fromName, email: fromEmail } = parseAddressField(fromRaw);

  if (!fromEmail) {
    return NextResponse.json({ error: "From is required" }, { status: 400 });
  }

  // Dedup on Mailjet MessageID
  if (messageId) {
    const existing = await prisma.email.findUnique({ where: { externalId: messageId } });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const toAddresses = parseAddressList(toRaw);
  const ccAddresses = parseAddressList(ccRaw);

  // Auto-detect client by sender email
  const client = await prisma.client.findFirst({
    where: { email: fromEmail },
    select: { id: true },
  });

  // Attachment metadata only — we do not store binary data in the app
  const attachmentsMeta: { name: string; mimeType: string; size: number }[] = [];
  for (let i = 1; i <= nbAttachments; i++) {
    const file = formData.get(`Attachment${i}`) as File | null;
    if (file) {
      attachmentsMeta.push({
        name: file.name || `bijlage-${i}`,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });
    }
  }

  try {
    const email = await prisma.email.create({
      data: {
        externalId: messageId,
        direction: EmailDirection.INBOUND,
        folder: EmailFolder.INBOX,
        fromName,
        fromEmail,
        toAddresses,
        ccAddresses,
        subject,
        bodyText,
        bodyHtml,
        attachmentsMeta: attachmentsMeta.length > 0 ? attachmentsMeta : undefined,
        clientId: client?.id ?? null,
        receivedAt: dateRaw ? new Date(dateRaw) : new Date(),
      },
    });

    logger.info("Mailjet inbound email stored", {
      emailId: email.id,
      from: fromEmail,
      subject,
      attachments: attachmentsMeta.length,
    });

    // Mailjet expects a 2xx response to acknowledge receipt
    return NextResponse.json({ ok: true, emailId: email.id });
  } catch (error) {
    logger.error("Failed to store inbound email", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
