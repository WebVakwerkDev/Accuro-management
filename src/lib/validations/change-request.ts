import { z } from "zod";
import {
  ChangeRequestSource,
  ChangeRequestStatus,
  ChangeRequestImpact,
} from "@prisma/client";

export const ChangeRequestFormSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  sourceType: z.nativeEnum(ChangeRequestSource),
  status: z.nativeEnum(ChangeRequestStatus),
  impact: z.nativeEnum(ChangeRequestImpact),
  githubIssueUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  githubBranch: z.string().optional(),
  githubPrUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  assignedToUserId: z.string().optional(),
});

export type ChangeRequestFormData = z.infer<typeof ChangeRequestFormSchema>;
