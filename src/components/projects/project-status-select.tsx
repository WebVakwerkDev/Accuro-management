"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { ProjectStatus } from "@prisma/client";
import { updateProject } from "@/actions/projects";
import { Loader2 } from "lucide-react";

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "LEAD", label: "Lead" },
  { value: "INTAKE", label: "Intake" },
  { value: "IN_PROGRESS", label: "In uitvoering" },
  { value: "WAITING_FOR_CLIENT", label: "Wacht op klant" },
  { value: "REVIEW", label: "Review" },
  { value: "COMPLETED", label: "Afgerond" },
  { value: "MAINTENANCE", label: "Onderhoud" },
  { value: "PAUSED", label: "Gepauzeerd" },
];

interface Props {
  projectId: string;
  status: ProjectStatus;
}

export function ProjectStatusSelect({ projectId, status: initialStatus }: Props) {
  const { data: session } = useSession();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!session?.user?.id) return;
    const newStatus = e.target.value as ProjectStatus;
    setStatus(newStatus);
    setLoading(true);
    try {
      await updateProject(projectId, { status: newStatus }, session.user.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
      <select
        value={status}
        onChange={handleChange}
        disabled={loading}
        className="form-select py-1 text-xs"
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
