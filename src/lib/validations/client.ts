import { z } from "zod";

export const ClientFormSchema = z.object({
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters"),
  contactName: z
    .string()
    .min(2, "Contact name must be at least 2 characters"),
  email: z
    .string()
    .email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  invoiceDetails: z.string().optional(),
});

export type ClientFormData = z.infer<typeof ClientFormSchema>;
