import { z } from "zod";
import {
  ProjectType,
  ProjectStatus,
  ProjectPriority,
} from "@prisma/client";

export const ProjectFormSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  clientId: z.string().min(1, "Client is required"),
  projectType: z.nativeEnum(ProjectType),
  status: z.nativeEnum(ProjectStatus),
  priority: z.nativeEnum(ProjectPriority),
  description: z.string().optional(),
  intakeSummary: z.string().optional(),
  scope: z.string().optional(),
  techStack: z.string().optional(),
  domainName: z.string().optional(),
  hostingInfo: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  ownerUserId: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type ProjectFormData = z.infer<typeof ProjectFormSchema>;
