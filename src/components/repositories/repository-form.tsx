"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { addRepository } from "@/actions/repositories";
import { Loader2 } from "lucide-react";

interface Props {
  projectId: string;
  onSuccess: () => void;
}

function parseGitHubUrl(url: string): { repoName: string; issueBoardUrl: string } | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\//, "").replace(/\/$/, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    const repoName = `${parts[0]}/${parts[1]}`;
    const base = `${u.origin}/${repoName}`;
    return { repoName, issueBoardUrl: `${base}/issues` };
  } catch {
    return null;
  }
}

export function RepositoryForm({ projectId, onSuccess }: Props) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");

  const parsed = parseGitHubUrl(repoUrl);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;
    if (!parsed) {
      setError("Voer een geldige GitHub repository-URL in (bijv. https://github.com/org/repo).");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const result = await addRepository(
        projectId,
        {
          repoName: parsed.repoName,
          repoUrl: repoUrl.replace(/\/$/, "").replace(/\.git$/, ""),
          defaultBranch: defaultBranch || "main",
          issueBoardUrl: parsed.issueBoardUrl,
        },
        session.user.id
      );

      if (result.success) {
        setRepoUrl("");
        onSuccess();
      } else {
        setError(result.error ?? "Repository toevoegen mislukt.");
      }
    } catch {
      setError("Er is een onverwachte fout opgetreden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label htmlFor="repo-url" className="form-label">
            Repository-URL <span className="text-red-500">*</span>
          </label>
          <input
            id="repo-url"
            type="url"
            required
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="form-input"
            placeholder="https://github.com/org/repo"
          />
          {parsed && (
            <p className="mt-1 text-xs text-gray-400">
              {parsed.repoName} &nbsp;·&nbsp; issues: {parsed.issueBoardUrl}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="repo-branch" className="form-label">
            Standaardbranch
          </label>
          <input
            id="repo-branch"
            type="text"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            className="form-input"
            placeholder="main"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading || !parsed} className="btn-primary">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Bezig met toevoegen…
            </>
          ) : (
            "Repository toevoegen"
          )}
        </button>
      </div>
    </form>
  );
}
