"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, ExternalLink, Trash2, ChevronUp, Github } from "lucide-react";
import { RepositoryForm } from "@/components/repositories/repository-form";
import { BriefingGenerator } from "@/components/briefing/briefing-generator";
import { getRepositories, deleteRepository } from "@/actions/repositories";
import { ChangeRequestStatus, ChangeRequestImpact } from "@prisma/client";

interface Repository {
  id: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string;
  issueBoardUrl: string | null;
}

interface ChangeRequest {
  id: string;
  title: string;
  status: ChangeRequestStatus;
  impact: ChangeRequestImpact;
}

interface Props {
  projectId: string;
  repositories: Repository[];
  changeRequests: ChangeRequest[];
}

export function ProjectGithubTab({
  projectId,
  repositories: initialRepos,
  changeRequests,
}: Props) {
  const { data: session } = useSession();
  const [repos, setRepos] = useState<Repository[]>(initialRepos);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleRepoAdded() {
    setShowForm(false);
    const result = await getRepositories(projectId);
    if (result.success && result.repositories) {
      setRepos(result.repositories);
    }
  }

  async function handleDelete(repoId: string) {
    if (!session?.user?.id) return;
    if (!confirm("Remove this repository from the project?")) return;
    setDeleting(repoId);
    try {
      await deleteRepository(repoId, projectId, session.user.id);
      setRepos((prev) => prev.filter((r) => r.id !== repoId));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Repositories */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Github className="h-4 w-4 text-gray-600" />
            Repositories ({repos.length})
          </h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-secondary"
          >
            {showForm ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Repository
              </>
            )}
          </button>
        </div>

        {showForm && (
          <div className="card p-5 mb-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">
              Link Repository
            </h4>
            <RepositoryForm projectId={projectId} onSuccess={handleRepoAdded} />
          </div>
        )}

        {repos.length > 0 ? (
          <div className="card divide-y divide-gray-50">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <a
                      href={repo.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {repo.repoName}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 space-x-2">
                    <span>Branch: {repo.defaultBranch}</span>
                    {repo.issueBoardUrl && (
                      <>
                        <span>&middot;</span>
                        <a
                          href={repo.issueBoardUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          Issue Board
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(repo.id)}
                  disabled={deleting === repo.id}
                  className="text-gray-400 hover:text-red-600 transition-colors p-1"
                  title="Remove repository"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-gray-400 card">
            No repositories linked. Add one above.
          </div>
        )}
      </div>

      {/* Developer Briefing Generator */}
      <div className="card p-5">
        <BriefingGenerator
          projectId={projectId}
          changeRequests={changeRequests}
        />
      </div>
    </div>
  );
}
