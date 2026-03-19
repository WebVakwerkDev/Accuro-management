"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Copy, FileText, FolderPlus, FilePlus2, Save, Trash2 } from "lucide-react";
import { createDocEntry, createDocFolder, deleteDocEntry, updateDocEntry } from "@/actions/docs";
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
  folders: DocFolder[];
}

export function GeneralDocsBrowser({ folders }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folders[0]?.id ?? null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(folders[0]?.docs[0]?.id ?? null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!folders.length) {
      setSelectedFolderId(null);
      setSelectedDocId(null);
      return;
    }

    const folderExists = folders.some((folder) => folder.id === selectedFolderId);
    const nextFolderId = folderExists ? selectedFolderId : folders[0].id;
    setSelectedFolderId(nextFolderId);

    const nextFolder = folders.find((folder) => folder.id === nextFolderId) ?? folders[0];
    const docExists = nextFolder.docs.some((doc) => doc.id === selectedDocId);
    setSelectedDocId(docExists ? selectedDocId : nextFolder.docs[0]?.id ?? null);
  }, [folders, selectedFolderId, selectedDocId]);

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? folders[0] ?? null,
    [folders, selectedFolderId],
  );

  const selectedDoc = useMemo(
    () => selectedFolder?.docs.find((doc) => doc.id === selectedDocId) ?? selectedFolder?.docs[0] ?? null,
    [selectedDocId, selectedFolder],
  );

  useEffect(() => {
    if (selectedDoc && editingDocId !== selectedDoc.id) {
      setEditingDocId(null);
    }
  }, [selectedDoc, editingDocId]);

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id || !newFolderName.trim()) return;

    const result = await createDocFolder({
      name: newFolderName.trim(),
      scope: DocScope.GENERAL,
      actorUserId: session.user.id,
    });

    if (result.success && result.folder) {
      setNewFolderName("");
      setSelectedFolderId(result.folder.id);
      setSelectedDocId(null);
      refresh();
    }
  }

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id || !selectedFolder || !newDocTitle.trim() || !newDocContent.trim()) return;

    const result = await createDocEntry({
      folderId: selectedFolder.id,
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
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-900">Algemene docs</h2>
        <p className="mt-1 text-sm text-gray-500">
          Gebruik links je mappen en documenten. Het gekozen document opent rechts.
        </p>
      </div>

      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-6">
        <aside className="card p-4">
          <form onSubmit={handleCreateFolder} className="space-y-3 border-b border-gray-100 pb-4">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="form-input"
              placeholder="Nieuwe map"
            />
            <button type="submit" className="btn-secondary w-full" disabled={isPending}>
              <FolderPlus className="h-4 w-4" />
              Map toevoegen
            </button>
          </form>

          <div className="mt-4 space-y-4">
            {folders.length > 0 ? (
              folders.map((folder) => (
                <div key={folder.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      setSelectedDocId(folder.docs[0]?.id ?? null);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                      selectedFolder?.id === folder.id
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {folder.name}
                  </button>

                  <div className="mt-2 space-y-1 pl-2">
                    {folder.docs.length > 0 ? (
                      folder.docs.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            setSelectedDocId(doc.id);
                          }}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                            selectedDoc?.id === doc.id
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                        >
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{doc.title}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-gray-400">Nog geen documenten.</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">Nog geen mappen. Maak links je eerste map aan.</p>
            )}
          </div>
        </aside>

        <div className="space-y-5">
          {selectedFolder && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900">
                Nieuw document in {selectedFolder.name}
              </h3>
              <form onSubmit={handleCreateDoc} className="mt-4 space-y-3">
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="form-input"
                  placeholder="Documenttitel"
                />
                <textarea
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  className="form-textarea"
                  rows={5}
                  placeholder="Schrijf hier de inhoud van het document..."
                />
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary" disabled={isPending}>
                    <FilePlus2 className="h-4 w-4" />
                    Document toevoegen
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card min-h-[520px] p-6">
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
                    rows={18}
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
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">
                        {selectedFolder?.name}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-gray-900">{selectedDoc.title}</h3>
                    </div>
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
              <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-gray-400">
                Kies links een document om het hier te openen.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
