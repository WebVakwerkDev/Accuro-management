import { getDocFolders } from "@/actions/docs";
import { GeneralDocsBrowser } from "@/components/docs/general-docs-browser";
import { loadDocsPageContent } from "@/lib/content";
import { DocScope } from "@prisma/client";

export default async function DocsPage() {
  const pageContent = await loadDocsPageContent();
  const result = await getDocFolders(DocScope.GENERAL);
  const folders = result.success ? result.folders ?? [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{pageContent.page.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{pageContent.page.description}</p>
      </div>

      <GeneralDocsBrowser
        folders={folders}
        content={pageContent.general}
      />
    </div>
  );
}
