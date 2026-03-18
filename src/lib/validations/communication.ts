import { z } from "zod";
import { CommunicationType } from "@prisma/client";

export const CommunicationFormSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  type: z.nativeEnum(CommunicationType),
  subject: z.string().min(2, "Subject must be at least 2 characters"),
  content: z.string().min(5, "Content must be at least 5 characters"),
  externalSenderName: z.string().optional(),
  externalSenderEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  isInternal: z.boolean().default(false),
  links: z.array(z.string()).default([]),
  occurredAt: z.string().min(1, "Date is required"),
});

export type CommunicationFormData = z.infer<typeof CommunicationFormSchema>;
