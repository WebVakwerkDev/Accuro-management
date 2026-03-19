"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Copy, FilePlus2, Save, Trash2 } from "lucide-react";
import { createClientDoc, deleteDocEntry, updateDocEntry } from "@/actions/docs";

interface ClientDoc {
  id: string;
  title: string;
  content: string;
  updatedAt: Date | string;
}

interface Props {
  clientId: string;
  docs: ClientDoc[];
}

export function ClientDocsPanel({ clientId, docs }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(docs[0]?.id ?? null);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const exists = docs.some((doc) => doc.id === selectedDocId);
    setSelectedDocId(exists ? selectedDocId : docs[0]?.id ?? null);
  }, [docs, selectedDocId]);

  const selectedDoc = useMemo(
    () => docs.find((doc) => doc.id === selectedDocId) ?? docs[0] ?? null,
    [docs, selectedDocId],
  );

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id || !newDocTitle.trim() || !newDocContent.trim()) return;

    const result = await createClientDoc({
      clientId,
      title: newDocTitle.trim(),
      content: newDocContent.trim(),
      actorUserId: session.user.id,
    });

    if (result.success && result.entry) {
      setNewDocTitle("");
      setNewDocContent("");
      setSelectedDocId(result.entry.id);
      refresh();
    }
  }

  function startEditing() {
    if (!selectedDoc) return;
    setEditingDocId(selectedDoc.id);
    setEditingTitle(selectedDoc.title);
    setEditingContent(selectedDoc.content);
  }

  async function saveDoc() {
    if (!session?.user?.id || !editingDocId) return;

    const result = await updateDocEntry({
      id: editingDocId,
      title: editingTitle.trim(),
      content: editingContent.trim(),
      actorUserId: session.user.id,
    });

    if (result.success) {
      setEditingDocId(null);
      refresh();
    }
  }

  async function removeDoc() {
    if (!session?.user?.id || !selectedDoc) return;
    if (!confirm("Dit document verwijderen?")) return;

    const result = await deleteDocEntry(selectedDoc.id, session.user.id);
    if (result.success) {
      setSelectedDocId(null);
      setEditingDocId(null);
      refresh();
    }
  }

  async function copyDoc() {
    if (!selectedDoc) return;
    await navigator.clipboard.writeText(selectedDoc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-6">
      <aside className="card p-4">
        <h3 className="text-base font-semibold text-gray-900">Klantdocs</h3>
        <p className="mt-1 text-sm text-gray-500">
          Klik op een document om het rechts te openen.
        </p>

        <form onSubmit={handleCreateDoc} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <input
            type="text"
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            className="form-input"
            placeholder="Nieuwe klantnotitie"
          />
          <textarea
            value={newDocContent}
            onChange={(e) => setNewDocContent(e.target.value)}
            className="form-textarea"
            rows={4}
            placeholder="Bijzonderheden, afspraken, vaste werkwijze..."
          />
          <button type="submit" className="btn-primary w-full" disabled={isPending}>
            <FilePlus2 className="h-4 w-4" />
            Document opslaan
          </button>
        </form>

        <div className="mt-5 space-y-2">
          {docs.length > 0 ? (
            docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDocId(doc.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left ${
                  selectedDoc?.id === doc.id
                    ? "border-blue-200 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{doc.title}</p>
              </button>
            ))
          ) : (
            <p className="text-sm text-gray-400">Nog geen klantdocs.</p>
          )}
        </div>
      </aside>

      <div className="card min-h-[460px] p-6">
        {selectedDoc ? (
          editingDocId === selectedDoc.id ? (
            <div className="space-y-4">
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="form-input"
              />
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="form-textarea"
                rows={16}
              />
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditingDocId(null)}>
                  Annuleren
                </button>
                <button type="button" className="btn-primary" onClick={saveDoc}>
                  <Save className="h-4 w-4" />
                  Opslaan
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
                <h3 className="text-xl font-semibold text-gray-900">{selectedDoc.title}</h3>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn-secondary" onClick={startEditing}>
                    Bewerken
                  </button>
                  <button type="button" className="btn-secondary" onClick={copyDoc}>
                    <Copy className="h-4 w-4" />
                    {copied ? "Gekopieerd" : "Kopiëren"}
                  </button>
                  <button type="button" className="text-gray-400 hover:text-red-600" onClick={removeDoc}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
                {selectedDoc.content}
              </div>
            </div>
          )
        ) : (
          <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-gray-400">
            Klik links op een klantdocument om het hier te openen.
          </div>
        )}
      </div>
    </div>
  );
}
