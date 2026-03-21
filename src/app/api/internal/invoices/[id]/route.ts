import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// PATCH /api/internal/invoices/[id] — n8n callback: PDF klaar, Google Drive URL opslaan
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authenticateApiKey(request)) {
    logger.warn("Rejected internal invoices API request");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { driveUrl?: string; driveFileId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!invoice) {
    return NextResponse.json({ success: false, error: "Factuur niet gevonden" }, { status: 404 });
  }

  logger.info("Invoice PDF callback from n8n", { invoiceId: id, driveUrl: body.driveUrl });

  return NextResponse.json({ success: true, invoiceId: id });
}
