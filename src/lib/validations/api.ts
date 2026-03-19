import { z } from "zod";
import {
  ProjectType,
  ProjectStatus,
  ProjectPriority,
  CommunicationType,
  ChangeRequestSource,
  ChangeRequestStatus,
  ChangeRequestImpact,
} from "@prisma/client";

// ─── Client (inline or by reference) ─────────────────────────────────────────

const ApiClientSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  contactName: z.string().min(2, "Contact name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  invoiceDetails: z.string().optional(),
});

// ─── Project ──────────────────────────────────────────────────────────────────

const ApiProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  projectType: z.nativeEnum(ProjectType).default(ProjectType.OTHER),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.INTAKE),
  priority: z.nativeEnum(ProjectPriority).default(ProjectPriority.MEDIUM),
  description: z.string().optional(),
  intakeSummary: z.string().optional(),
  scope: z.string().optional(),
  techStack: z.string().optional(),
  domainName: z.string().optional(),
  hostingInfo: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  ownerUserId: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

// ─── Initial communication ────────────────────────────────────────────────────

const ApiCommunicationSchema = z.object({
  type: z.nativeEnum(CommunicationType).default(CommunicationType.OTHER),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
  externalSenderName: z.string().optional(),
  externalSenderEmail: z.string().email().optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

// ─── Initial change request ──────────────────────────────────────────────────

const ApiChangeRequestSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().min(1, "Description is required"),
  sourceType: z.nativeEnum(ChangeRequestSource).default(ChangeRequestSource.INTERNAL),
  status: z.nativeEnum(ChangeRequestStatus).default(ChangeRequestStatus.NEW),
  impact: z.nativeEnum(ChangeRequestImpact).default(ChangeRequestImpact.MEDIUM),
});

// ─── Source tracking ──────────────────────────────────────────────────────────

const ApiSourceSchema = z.object({
  type: z.string().min(1),
  label: z.string().optional(),
});

// ─── Top-level request body ───────────────────────────────────────────────────

export const ProjectCreateApiSchema = z
  .object({
    clientId: z.string().optional(),
    client: ApiClientSchema.optional(),
    project: ApiProjectSchema,
    initialCommunication: ApiCommunicationSchema.optional(),
    initialChangeRequest: ApiChangeRequestSchema.optional(),
    source: ApiSourceSchema.optional(),
  })
  .refine(
    (data) => data.clientId || data.client,
    { message: "Either clientId or client object is required", path: ["client"] },
  );

export type ProjectCreateApiInput = z.infer<typeof ProjectCreateApiSchema>;
