"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { CreateWorkspaceModal } from "~/app/_components/create-workspace-modal";

export default function HomePage() {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: workspaces, isLoading } = api.workspace.list.useQuery();

  const handleWorkspaceCreated = (workspaceId: string) => {
    setShowCreateModal(false);
    void router.push(`/workspace/${workspaceId}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-[var(--muted)]">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[var(--bg)]">
        {/* Header */}
        <div className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <span className="text-xl font-black">N</span>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-[var(--fg)]">NotTable</h1>
                  <p className="text-sm text-[var(--muted)]">Your Workspaces</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-[var(--border-soft)] px-4 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
                  type="button"
                >
                  Settings
                </button>
                <Link
                  href="/api/auth/signout"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Sign Out
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-[var(--fg)]">Workspaces</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              type="button"
            >
              + Create Workspace
            </button>
          </div>

          {!workspaces || workspaces.length === 0 ? (
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-12 text-center">
              <div className="mb-4 text-4xl">🗄️</div>
              <h3 className="mb-2 text-lg font-semibold text-[var(--fg)]">
                No workspaces yet
              </h3>
              <p className="mb-4 text-sm text-[var(--muted)]">
                Create your first workspace to get started
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                type="button"
              >
                + Create Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/workspace/${workspace.id}`}
                  className="group rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 transition hover:border-blue-500 hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <span className="text-xl font-bold">
                        {workspace.name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                      {workspace._count.bases}{" "}
                      {workspace._count.bases === 1 ? "base" : "bases"}
                    </div>
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-[var(--fg)] group-hover:text-blue-600 transition-colors">
                    {workspace.name}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span>ID: {workspace.id.slice(0, 8)}...</span>
                    <span>•</span>
                    <span>
                      Updated {new Date(workspace.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleWorkspaceCreated}
      />
    </>
  );
}