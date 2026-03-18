"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { createProject } from "@/actions/projects";
import { Loader2 } from "lucide-react";
import { ProjectType, ProjectStatus, ProjectPriority } from "@prisma/client";

interface Client {
  id: string;
  companyName: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Props {
  clients: Client[];
  users: User[];
  defaultClientId?: string;
}

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "NEW_WEBSITE", label: "New Website" },
  { value: "REDESIGN", label: "Redesign" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "LANDING_PAGE", label: "Landing Page" },
  { value: "WEBSHOP", label: "Webshop" },
  { value: "OTHER", label: "Other" },
];

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "LEAD", label: "Lead" },
  { value: "INTAKE", label: "Intake" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_FOR_CLIENT", label: "Waiting for Client" },
  { value: "REVIEW", label: "Review" },
  { value: "COMPLETED", label: "Completed" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "PAUSED", label: "Paused" },
];

const PROJECT_PRIORITIES: { value: ProjectPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export function CreateProjectForm({ clients, users, defaultClientId }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");

  const [form, setForm] = useState({
    name: "",
    clientId: defaultClientId ?? "",
    projectType: "NEW_WEBSITE" as ProjectType,
    status: "INTAKE" as ProjectStatus,
    priority: "MEDIUM" as ProjectPriority,
    description: "",
    intakeSummary: "",
    scope: "",
    techStack: "",
    domainName: "",
    hostingInfo: "",
    startDate: "",
    dueDate: "",
    ownerUserId: "",
  });

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;
    setError(null);
    setLoading(true);

    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await createProject(
        {
          ...form,
          tags,
          ownerUserId: form.ownerUserId || undefined,
          startDate: form.startDate || undefined,
          dueDate: form.dueDate || undefined,
        },
        session.user.id
      );

      if (result.success && result.project) {
        router.push(`/projects/${result.project.id}`);
      } else {
        setError(result.error ?? "Failed to create project.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Project Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="name" className="form-label">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                className="form-input"
                placeholder="Website redesign for Acme"
              />
            </div>
            <div>
              <label htmlFor="clientId" className="form-label">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                id="clientId"
                name="clientId"
                required
                value={form.clientId}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="projectType" className="form-label">
                Project Type
              </label>
              <select
                id="projectType"
                name="projectType"
                value={form.projectType}
                onChange={handleChange}
                className="form-select"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="form-label">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="form-select"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="priority" className="form-label">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="form-select"
              >
                {PROJECT_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ownerUserId" className="form-label">
                Project Owner
              </label>
              <select
                id="ownerUserId"
                name="ownerUserId"
                value={form.ownerUserId}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">No owner assigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="startDate" className="form-label">
                Start Date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="dueDate" className="form-label">
                Due Date
              </label>
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleChange}
                className="form-input"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="tags" className="form-label">
                Tags{" "}
                <span className="font-normal text-gray-400">
                  (comma-separated)
                </span>
              </label>
              <input
                id="tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="form-input"
                placeholder="wordpress, woocommerce, seo"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={form.description}
                onChange={handleChange}
                className="form-textarea"
                placeholder="Short description of the project…"
              />
            </div>
          </div>
        </div>

        {/* Technical & scope */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Technical Details &amp; Scope
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="intakeSummary" className="form-label">
                Intake Summary
              </label>
              <textarea
                id="intakeSummary"
                name="intakeSummary"
                rows={4}
                value={form.intakeSummary}
                onChange={handleChange}
                className="form-textarea"
                placeholder="Summary from the intake meeting…"
              />
            </div>
            <div>
              <label htmlFor="scope" className="form-label">
                Scope
              </label>
              <textarea
                id="scope"
                name="scope"
                rows={4}
                value={form.scope}
                onChange={handleChange}
                className="form-textarea"
                placeholder="What is and isn't included in this project…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="techStack" className="form-label">
                  Tech Stack
                </label>
                <input
                  id="techStack"
                  name="techStack"
                  type="text"
                  value={form.techStack}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Next.js, Prisma, PostgreSQL"
                />
              </div>
              <div>
                <label htmlFor="domainName" className="form-label">
                  Domain
                </label>
                <input
                  id="domainName"
                  name="domainName"
                  type="text"
                  value={form.domainName}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="acme.nl"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="hostingInfo" className="form-label">
                  Hosting Info
                </label>
                <input
                  id="hostingInfo"
                  name="hostingInfo"
                  type="text"
                  value={form.hostingInfo}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Vercel, AWS, Cloudflare, etc."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Project"
            )}
          </button>
          <Link href="/projects" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
