import Link from "next/link";
import { FolderKanban, ArrowLeft } from "lucide-react";

export default function ProjectNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="rounded-xl bg-gray-100 p-6 mb-5">
        <FolderKanban className="h-10 w-10 text-gray-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Project not found
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        The project you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Link href="/projects" className="btn-primary">
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>
    </div>
  );
}
