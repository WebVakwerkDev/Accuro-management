"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface ProjectTabsProps {
  projectId: string;
  activeTab: string;
  tabs: Tab[];
}

export function ProjectTabs({ projectId, activeTab, tabs }: ProjectTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTabClick(tabId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.push(`/projects/${projectId}?${params.toString()}`);
  }

  return (
    <div className="flex gap-0.5 border-b border-gray-200 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === tab.id
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full text-xs w-5 h-5",
                activeTab === tab.id
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-500"
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
