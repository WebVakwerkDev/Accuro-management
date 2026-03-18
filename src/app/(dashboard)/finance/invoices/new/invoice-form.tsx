"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { createInvoice } from "@/actions/invoices";
import { Loader2 } from "lucide-react";
import { InvoiceStatus } from "@prisma/client";
import { formatCurrency } from "@/lib/utils";

interface Client {
  id: string;
  companyName: string;
}

interface Project {
  id: string;
  name: string;
  client: { id: string; companyName: string };
}

interface Props {
  clients: Client[];
  projects: Project[];
  defaultInvoiceNumber: string;
  defaultClientId?: string;
  defaultProjectId?: string;
}

const STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
];

export function InvoiceForm({
  clients,
  projects,
  defaultInvoiceNumber,
  defaultClientId,
  defaultProjectId,
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [form, setForm] = useState({
    clientId: defaultClientId ?? "",
    projectId: defaultProjectId ?? "",
    invoiceNumber: defaultInvoiceNumber,
    issueDate: today,
    dueDate: thirtyDaysLater,
    status: "DRAFT" as InvoiceStatus,
    subtotal: "",
    vatRate: "21",
    description: "",
    notes: "",
  });

  // Filter projects by selected client
  const filteredProjects = useMemo(
    () =>
      form.clientId
        ? projects.filter((p) => p.client.id === form.clientId)
        : projects,
    [form.clientId, projects]
  );

  // Live calculations
  const subtotalNum = parseFloat(form.subtotal) || 0;
  const vatRateNum = parseFloat(form.vatRate) || 0;
  const vatAmount = subtotalNum * (vatRateNum / 100);
  const totalAmount = subtotalNum + vatAmount;

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      // Clear project when client changes
      ...(name === "clientId" ? { projectId: "" } : {}),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;
    setError(null);
    setLoading(true);

    try {
      const result = await createInvoice(
        {
          clientId: form.clientId,
          projectId: form.projectId || undefined,
          invoiceNumber: form.invoiceNumber,
          issueDate: form.issueDate,
          dueDate: form.dueDate,
          status: form.status,
          subtotal: parseFloat(form.subtotal),
          vatRate: parseFloat(form.vatRate),
          description: form.description,
          notes: form.notes || undefined,
        },
        session.user.id
      );

      if (result.success) {
        router.push("/finance");
      } else {
        setError(result.error ?? "Failed to create invoice.");
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
        {/* Invoice info */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Invoice Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="inv-client" className="form-label">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                id="inv-client"
                name="clientId"
                required
                value={form.clientId}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inv-project" className="form-label">
                Project
              </label>
              <select
                id="inv-project"
                name="projectId"
                value={form.projectId}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">No project</option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inv-number" className="form-label">
                Invoice Number <span className="text-red-500">*</span>
              </label>
              <input
                id="inv-number"
                name="invoiceNumber"
                type="text"
                required
                value={form.invoiceNumber}
                onChange={handleChange}
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="inv-status" className="form-label">
                Status
              </label>
              <select
                id="inv-status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="form-select"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inv-issueDate" className="form-label">
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                id="inv-issueDate"
                name="issueDate"
                type="date"
                required
                value={form.issueDate}
                onChange={handleChange}
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="inv-dueDate" className="form-label">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                id="inv-dueDate"
                name="dueDate"
                type="date"
                required
                value={form.dueDate}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* Amounts */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Amounts
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="inv-subtotal" className="form-label">
                Subtotal (excl. VAT) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  €
                </span>
                <input
                  id="inv-subtotal"
                  name="subtotal"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.subtotal}
                  onChange={handleChange}
                  className="form-input pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label htmlFor="inv-vatRate" className="form-label">
                VAT Rate (%)
              </label>
              <input
                id="inv-vatRate"
                name="vatRate"
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.vatRate}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          {/* Live calculation */}
          {subtotalNum > 0 && (
            <div className="rounded-md bg-gray-50 border border-gray-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotalNum)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT ({vatRateNum}%)</span>
                <span>{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Description &amp; Notes
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="inv-description" className="form-label">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="inv-description"
                name="description"
                rows={3}
                required
                value={form.description}
                onChange={handleChange}
                className="form-textarea"
                placeholder="What does this invoice cover?"
              />
            </div>
            <div>
              <label htmlFor="inv-notes" className="form-label">
                Notes
              </label>
              <textarea
                id="inv-notes"
                name="notes"
                rows={2}
                value={form.notes}
                onChange={handleChange}
                className="form-textarea"
                placeholder="Payment instructions, terms, etc."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Invoice"
            )}
          </button>
          <Link href="/finance" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
