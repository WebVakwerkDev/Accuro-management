/**
 * Job: invoice:send-reminder
 *
 * Sends an invoice payment reminder to a client.
 * Future: integrate with email provider (Resend, Nodemailer, etc.)
 */
import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@prisma/client";
import type { InvoiceReminderJobData } from "@/lib/queue";

export async function processInvoiceReminder(data: InvoiceReminderJobData) {
  const { invoiceId, clientEmail, clientName, invoiceNumber, totalAmount, dueDate } = data;

  // Verify the invoice is still unpaid before sending
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true },
  });

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  if (invoice.status === InvoiceStatus.PAID) {
    console.log(`[invoice-reminder] Invoice ${invoiceNumber} already paid — skipping reminder`);
    return { skipped: true, reason: "already_paid" };
  }

  // --- Future: send actual email ---
  // await sendEmail({
  //   to: clientEmail,
  //   subject: `Betalingsherinnering: Factuur ${invoiceNumber}`,
  //   body: buildReminderEmail(clientName, invoiceNumber, totalAmount, dueDate),
  // });

  console.log(
    `[invoice-reminder] PLACEHOLDER: Would send reminder to ${clientEmail} for invoice ${invoiceNumber} (€${totalAmount}, due ${dueDate})`
  );

  return {
    sent: false,
    placeholder: true,
    invoiceId,
    clientEmail,
  };
}
