import { getDocFolders } from "@/actions/docs";
import { DocsManager } from "@/components/docs/docs-manager";
import { DocScope } from "@prisma/client";

export default async function DocsPage() {
  const result = await getDocFolders(DocScope.GENERAL);
  const folders = result.success ? result.folders ?? [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Docs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Algemene interne documentatie, werkwijzen, communicatie-afspraken en templates.
        </p>
      </div>

      <DocsManager
        scope={DocScope.GENERAL}
        folders={folders}
        title="Algemene docs"
        description="Gebruik mappen voor bijvoorbeeld e-mailtemplates, interne werkwijzen en standaardcommunicatie."
      />
    </div>
  );
}
