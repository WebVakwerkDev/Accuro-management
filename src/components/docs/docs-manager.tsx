"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Copy, FolderPlus, FilePlus2, Save, Trash2 } from "lucide-react";
import {
  createDocEntry,
  createDocFolder,
  deleteDocEntry,
  updateDocEntry,
} from "@/actions/docs";
import { DocScope } from "@prisma/client";

interface DocEntry {
  id: string;
  title: string;
  content: string;
  updatedAt: Date | string;
}

interface DocFolder {
  id: string;
  name: string;
  docs: DocEntry[];
}

interface Props {
  scope: DocScope;
  folders: DocFolder[];
  clientId?: string;
  title: string;
  description: string;
}

export function DocsManager({
  scope,
  folders,
  clientId,
  title,
  description,
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [newFolderName, setNewFolderName] = useState("");
  const [newDocTitleByFolder, setNewDocTitleByFolder] = useState<Record<string, string>>({});
  const [newDocContentByFolder, setNewDocContentByFolder] = useState<Record<string, string>>({});
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id || !newFolderName.trim()) return;

    await createDocFolder({
      name: newFolderName.trim(),
      scope,
      clientId,
      actorUserId: session.user.id,
    });

    setNewFolderName("");
    refresh();
  }

  async function handleCreateDoc(folderId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;

    const title = newDocTitleByFolder[folderId]?.trim();
    const content = newDocContentByFolder[folderId]?.trim();
    if (!title || !content) return;

    await createDocEntry({
      folderId,
      title,
      content,
      actorUserId: session.user.id,
    });

    setNewDocTitleByFolder((prev) => ({ ...prev, [folderId]: "" }));
    setNewDocContentByFolder((prev) => ({ ...prev, [folderId]: "" }));
    refresh();
  }

  function beginEdit(doc: DocEntry) {
    setEditingDocId(doc.id);
    setEditingTitle(doc.title);
    setEditingContent(doc.content);
  }

  async function handleSaveDoc() {
    if (!session?.user?.id || !editingDocId) return;

    await updateDocEntry({
      id: editingDocId,
      title: editingTitle,
      content: editingContent,
      actorUserId: session.user.id,
    });

    setEditingDocId(null);
    setEditingTitle("");
    setEditingContent("");
    refresh();
  }

  async function handleDeleteDoc(docId: string) {
    if (!session?.user?.id) return;
    if (!confirm("Dit document verwijderen?")) return;

    await deleteDocEntry(docId, session.user.id);
    if (editingDocId === docId) {
      setEditingDocId(null);
      setEditingTitle("");
      setEditingContent("");
    }
    refresh();
  }

  async function handleCopy(content: string, docId: string) {
    await navigator.clipboard.writeText(content);
    setCopiedDocId(docId);
    setTimeout(() => setCopiedDocId(null), 1500);
  }

  async function handleCopyFolder(folder: DocFolder) {
    const combined = folder.docs
      .map((doc) => `# ${doc.title}\n\n${doc.content}`)
      .join("\n\n---\n\n");

    await navigator.clipboard.writeText(combined);
    setCopiedDocId(`folder:${folder.id}`);
    setTimeout(() => setCopiedDocId(null), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>

        <form onSubmit={handleCreateFolder} className="mt-4 flex gap-3">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="form-input"
            placeholder="Nieuwe mapnaam"
          />
          <button type="submit" className="btn-primary" disabled={isPending}>
            <FolderPlus className="h-4 w-4" />
            Map toevoegen
          </button>
        </form>
      </div>

      {folders.length > 0 ? (
        <div className="space-y-5">
          {folders.map((folder) => (
            <div key={folder.id} className="card p-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-gray-900">{folder.name}</h3>
                {folder.docs.length > 0 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleCopyFolder(folder)}
                  >
                    <Copy className="h-4 w-4" />
                    {copiedDocId === `folder:${folder.id}` ? "Map gekopieerd" : "Map kopiëren"}
                  </button>
                )}
              </div>

              <form
                onSubmit={(e) => handleCreateDoc(folder.id, e)}
                className="mt-4 space-y-3"
              >
                <input
                  type="text"
                  value={newDocTitleByFolder[folder.id] ?? ""}
                  onChange={(e) =>
                    setNewDocTitleByFolder((prev) => ({
                      ...prev,
                      [folder.id]: e.target.value,
                    }))
                  }
                  className="form-input"
                  placeholder="Documenttitel"
                />
                <textarea
                  value={newDocContentByFolder[folder.id] ?? ""}
                  onChange={(e) =>
                    setNewDocContentByFolder((prev) => ({
                      ...prev,
                      [folder.id]: e.target.value,
                    }))
                  }
                  className="form-textarea"
                  rows={4}
                  placeholder="Inhoud van het document…"
                />
                <div className="flex justify-end">
                  <button type="submit" className="btn-secondary" disabled={isPending}>
                    <FilePlus2 className="h-4 w-4" />
                    Document toevoegen
                  </button>
                </div>
              </form>

              <div className="mt-5 space-y-4">
                {folder.docs.length > 0 ? (
                  folder.docs.map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-gray-200 p-4">
                      {editingDocId === doc.id ? (
                        <div className="space-y-3">
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
                            rows={10}
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setEditingDocId(null)}
                            >
                              Annuleren
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleSaveDoc}
                            >
                              <Save className="h-4 w-4" />
                              Opslaan
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="font-medium text-gray-900">{doc.title}</h4>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                                {doc.content}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => beginEdit(doc)}
                              >
                                Bewerken
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleCopy(doc.content, doc.id)}
                              >
                                <Copy className="h-4 w-4" />
                                {copiedDocId === doc.id ? "Gekopieerd" : "Kopiëren"}
                              </button>
                              <button
                                type="button"
                                className="text-gray-400 hover:text-red-600"
                                onClick={() => handleDeleteDoc(doc.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">Nog geen documenten in deze map.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-sm text-gray-400">
          Nog geen mappen. Maak hierboven je eerste map aan.
        </div>
      )}
    </div>
  );
}
