"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { updateBusinessSettings } from "@/actions/business-settings";
import type { BusinessSettings } from "@prisma/client";

interface Props {
  initial: BusinessSettings | null;
}

export function BusinessSettingsForm({ initial }: Props) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyName: initial?.companyName ?? "",
    address: initial?.address ?? "",
    kvkNumber: initial?.kvkNumber ?? "",
    vatNumber: initial?.vatNumber ?? "",
    iban: initial?.iban ?? "",
    bankName: initial?.bankName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    logoUrl: initial?.logoUrl ?? "",
    websiteUrl: initial?.websiteUrl ?? "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;
    setLoading(true);
    setError(null);
    setSaved(false);

    const result = await updateBusinessSettings(
      {
        companyName: form.companyName,
        address: form.address || undefined,
        kvkNumber: form.kvkNumber || undefined,
        vatNumber: form.vatNumber || undefined,
        iban: form.iban || undefined,
        bankName: form.bankName || undefined,
        email: form.email,
        phone: form.phone || undefined,
        logoUrl: form.logoUrl || undefined,
        websiteUrl: form.websiteUrl || undefined,
      },
      session.user.id
    );

    setLoading(false);
    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error ?? "Opslaan mislukt.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="form-label">Bedrijfsnaam *</label>
          <input name="companyName" required className="form-input" value={form.companyName} onChange={handleChange} placeholder="Webvakwerk" />
        </div>

        <div className="col-span-2">
          <label className="form-label">Adres</label>
          <input name="address" className="form-input" value={form.address} onChange={handleChange} placeholder="Straat 1, 1234 AB Amsterdam" />
        </div>

        <div>
          <label className="form-label">KVK-nummer</label>
          <input name="kvkNumber" className="form-input" value={form.kvkNumber} onChange={handleChange} placeholder="12345678" maxLength={8} />
        </div>

        <div>
          <label className="form-label">BTW-nummer</label>
          <input name="vatNumber" className="form-input" value={form.vatNumber} onChange={handleChange} placeholder="NL000000000B00" />
        </div>

        <div>
          <label className="form-label">IBAN</label>
          <input name="iban" className="form-input" value={form.iban} onChange={handleChange} placeholder="NL00BANK0000000000" />
        </div>

        <div>
          <label className="form-label">Banknaam</label>
          <input name="bankName" className="form-input" value={form.bankName} onChange={handleChange} placeholder="ABN AMRO" />
        </div>

        <div>
          <label className="form-label">E-mail *</label>
          <input name="email" type="email" required className="form-input" value={form.email} onChange={handleChange} placeholder="info@bedrijf.nl" />
        </div>

        <div>
          <label className="form-label">Telefoon</label>
          <input name="phone" className="form-input" value={form.phone} onChange={handleChange} placeholder="+31 6 00000000" />
        </div>

        <div>
          <label className="form-label">Website URL</label>
          <input name="websiteUrl" type="url" className="form-input" value={form.websiteUrl} onChange={handleChange} placeholder="https://bedrijf.nl" />
        </div>

        <div>
          <label className="form-label">Logo URL</label>
          <input name="logoUrl" type="url" className="form-input" value={form.logoUrl} onChange={handleChange} placeholder="https://bedrijf.nl/logo.png" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Opslaan…" : "Opslaan"}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">✓ Opgeslagen</span>
        )}
      </div>
    </form>
  );
}
