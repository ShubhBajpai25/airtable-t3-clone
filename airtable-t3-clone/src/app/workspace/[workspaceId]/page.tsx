import Link from "next/link";
import { api } from "~/trpc/server";
import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await getServerAuthSession();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  const { workspaceId } = await params;
  const workspace = await api.workspace.get({ workspaceId });

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="border-b border-[var(--border-soft)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                <span className="text-xl font-black">N</span>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-[var(--fg)]">{workspace.name}</h1>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  {workspace.bases.length} {workspace.bases.length === 1 ? 'base' : 'bases'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-lg border border-[var(--border-soft)] px-4 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
              >
                ← All Workspaces
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[var(--fg)]">Bases</h2>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            type="button"
            disabled
            title="Coming soon"
          >
            + Create Base
          </button>
        </div>

        {workspace.bases.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-12 text-center">
            <div className="mb-4 text-4xl">📦</div>
            <h3 className="mb-2 text-lg font-semibold text-[var(--fg)]">No bases yet</h3>
            <p className="text-sm text-[var(--muted)]">
              Create your first base to start organizing your data
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspace.bases.map((base) => (
              <Link
                key={base.id}
                href={`/workspace/${workspaceId}/base/${base.id}`}
                className="group rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-6 transition hover:border-blue-500 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                    <span className="text-2xl">🗄️</span>
                  </div>
                </div>

                <h3 className="mb-2 text-lg font-semibold text-[var(--fg)] group-hover:text-blue-600 transition-colors">
                  {base.name}
                </h3>

                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <span>Updated {new Date(base.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}