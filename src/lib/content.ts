import { promises as fs } from "node:fs";
import path from "node:path";
import { PAGES_CONTENT_ROOT } from "../../config/content";

export interface DocsPageContent {
  page: {
    title: string;
    description: string;
  };
  general: {
    title: string;
    description: string;
    newFolderPlaceholder: string;
    addFolderButton: string;
    emptyFolders: string;
    emptyFolderDocs: string;
    newDocumentPrefix: string;
    newDocumentTitlePlaceholder: string;
    newDocumentContentPlaceholder: string;
    addDocumentButton: string;
    emptyPreview: string;
    cancelButton: string;
    saveButton: string;
    editButton: string;
    copyButton: string;
    copiedButton: string;
    deleteConfirm: string;
  };
  client: {
    title: string;
    description: string;
    newDocumentTitlePlaceholder: string;
    newDocumentContentPlaceholder: string;
    addDocumentButton: string;
    emptyList: string;
    emptyPreview: string;
    cancelButton: string;
    saveButton: string;
    editButton: string;
    copyButton: string;
    copiedButton: string;
    deleteConfirm: string;
  };
}

export async function loadDocsPageContent(): Promise<DocsPageContent> {
  const filePath = path.join(PAGES_CONTENT_ROOT, "docs.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as DocsPageContent;
}
