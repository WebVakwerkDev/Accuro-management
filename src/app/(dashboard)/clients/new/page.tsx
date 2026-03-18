"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { createClient } from "@/actions/clients";
import { Loader2, ArrowLeft } from "lucide-react";

export default function NewClientPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    vatNumber: "",
    chamberOfCommerceNumber: "",
    notes: "",
    invoiceDetails: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;
    setError(null);
    setLoading(true);

    try {
      const result = await createClient(form, session.user.id);
      if (result.success && result.client) {
        router.push(`/clients/${result.client.id}`);
      } else {
        setError(result.error ?? "Failed to create client.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <div>
          <Link
            href="/clients"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Clients
          </Link>
          <h1 className="page-title">New Client</h1>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Information */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Contact Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="companyName" className="form-label">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                required
                value={form.companyName}
                onChange={handleChange}
                className="form-input"
                placeholder="Acme B.V."
              />
            </div>
            <div>
              <label htmlFor="contactName" className="form-label">
                Contact Person
              </label>
              <input
                id="contactName"
                name="contactName"
                type="text"
                value={form.contactName}
                onChange={handleChange}
                className="form-input"
                placeholder="Jan Janssen"
              />
            </div>
            <div>
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="form-input"
                placeholder="jan@acme.nl"
              />
            </div>
            <div>
              <label htmlFor="phone" className="form-label">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                className="form-input"
                placeholder="+31 6 12345678"
              />
            </div>
            <div>
              <label htmlFor="address" className="form-label">
                Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                value={form.address}
                onChange={handleChange}
                className="form-input"
                placeholder="Straat 1, 1234 AB Amsterdam"
              />
            </div>
          </div>
        </div>

        {/* Company Details */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Company Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="vatNumber" className="form-label">
                VAT Number
              </label>
              <input
                id="vatNumber"
                name="vatNumber"
                type="text"
                value={form.vatNumber}
                onChange={handleChange}
                className="form-input"
                placeholder="NL000000000B01"
              />
            </div>
            <div>
              <label htmlFor="chamberOfCommerceNumber" className="form-label">
                Chamber of Commerce
              </label>
              <input
                id="chamberOfCommerceNumber"
                name="chamberOfCommerceNumber"
                type="text"
                value={form.chamberOfCommerceNumber}
                onChange={handleChange}
                className="form-input"
                placeholder="12345678"
              />
            </div>
          </div>
        </div>

        {/* Notes & Billing */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Notes &amp; Billing
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="invoiceDetails" className="form-label">
                Invoice Details
              </label>
              <textarea
                id="invoiceDetails"
                name="invoiceDetails"
                rows={3}
                value={form.invoiceDetails}
                onChange={handleChange}
                className="form-textarea"
                placeholder="Payment terms, billing address override, etc."
              />
            </div>
            <div>
              <label htmlFor="notes" className="form-label">
                Internal Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={form.notes}
                onChange={handleChange}
                className="form-textarea"
                placeholder="Any internal notes about this client…"
              />
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
              "Create Client"
            )}
          </button>
          <Link href="/clients" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
