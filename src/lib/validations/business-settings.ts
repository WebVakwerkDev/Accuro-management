import { z } from "zod";

export const BusinessSettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Bedrijfsnaam is verplicht"),
  address: z.string().trim().optional(),
  kvkNumber: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "KVK-nummer moet 8 cijfers zijn")
    .optional()
    .or(z.literal("")),
  vatNumber: z
    .string()
    .trim()
    .regex(/^NL\d{9}B\d{2}$/, "BTW-nummer moet het formaat NL000000000B00 hebben")
    .optional()
    .or(z.literal("")),
  iban: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/, "Ongeldig IBAN-formaat")
    .optional()
    .or(z.literal("")),
  bankName: z.string().trim().optional(),
  email: z.string().trim().email("Ongeldig e-mailadres"),
  phone: z.string().trim().optional(),
  logoUrl: z.string().trim().url("Ongeldige URL").optional().or(z.literal("")),
  websiteUrl: z.string().trim().url("Ongeldige URL").optional().or(z.literal("")),
});

export type BusinessSettingsData = z.infer<typeof BusinessSettingsSchema>;
