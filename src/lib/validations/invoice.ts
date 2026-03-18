import { z } from "zod";
import { InvoiceStatus } from "@prisma/client";

export const InvoiceFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  projectId: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.nativeEnum(InvoiceStatus),
  subtotal: z.number().positive("Subtotal must be a positive number"),
  vatRate: z
    .number()
    .min(0, "VAT rate must be at least 0")
    .max(100, "VAT rate cannot exceed 100")
    .default(21),
  description: z.string().min(2, "Description must be at least 2 characters"),
  notes: z.string().optional(),
});

export type InvoiceFormData = z.infer<typeof InvoiceFormSchema>;
