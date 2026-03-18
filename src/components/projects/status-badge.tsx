import {
  ProjectStatus,
  ChangeRequestStatus,
  InvoiceStatus,
  ProjectPriority,
  ChangeRequestImpact,
} from "@prisma/client";
import { Badge } from "@/components/ui/badge";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, { variant: Parameters<typeof Badge>[0]["variant"]; label: string }> = {
    LEAD: { variant: "info", label: "Lead" },
    INTAKE: { variant: "purple", label: "Intake" },
    IN_PROGRESS: { variant: "info", label: "In Progress" },
    WAITING_FOR_CLIENT: { variant: "warning", label: "Waiting for Client" },
    REVIEW: { variant: "purple", label: "Review" },
    COMPLETED: { variant: "success", label: "Completed" },
    MAINTENANCE: { variant: "default", label: "Maintenance" },
    PAUSED: { variant: "default", label: "Paused" },
  };

  const { variant, label } = map[status] ?? { variant: "default", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function ChangeRequestStatusBadge({
  status,
}: {
  status: ChangeRequestStatus;
}) {
  const map: Record<ChangeRequestStatus, { variant: Parameters<typeof Badge>[0]["variant"]; label: string }> = {
    NEW: { variant: "info", label: "New" },
    REVIEWED: { variant: "purple", label: "Reviewed" },
    PLANNED: { variant: "warning", label: "Planned" },
    IN_PROGRESS: { variant: "info", label: "In Progress" },
    WAITING_FOR_FEEDBACK: { variant: "warning", label: "Waiting for Feedback" },
    DONE: { variant: "success", label: "Done" },
  };

  const { variant, label } = map[status] ?? { variant: "default", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { variant: Parameters<typeof Badge>[0]["variant"]; label: string }> = {
    DRAFT: { variant: "default", label: "Draft" },
    SENT: { variant: "info", label: "Sent" },
    PAID: { variant: "success", label: "Paid" },
    OVERDUE: { variant: "danger", label: "Overdue" },
  };

  const { variant, label } = map[status] ?? { variant: "default", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: ProjectPriority }) {
  const map: Record<ProjectPriority, { variant: Parameters<typeof Badge>[0]["variant"]; label: string }> = {
    LOW: { variant: "default", label: "Low" },
    MEDIUM: { variant: "info", label: "Medium" },
    HIGH: { variant: "warning", label: "High" },
    URGENT: { variant: "danger", label: "Urgent" },
  };

  const { variant, label } = map[priority] ?? { variant: "default", label: priority };
  return <Badge variant={variant}>{label}</Badge>;
}

export function ImpactBadge({ impact }: { impact: ChangeRequestImpact }) {
  const map: Record<ChangeRequestImpact, { variant: Parameters<typeof Badge>[0]["variant"]; label: string }> = {
    SMALL: { variant: "success", label: "Small" },
    MEDIUM: { variant: "warning", label: "Medium" },
    LARGE: { variant: "danger", label: "Large" },
  };

  const { variant, label } = map[impact] ?? { variant: "default", label: impact };
  return <Badge variant={variant}>{label}</Badge>;
}
