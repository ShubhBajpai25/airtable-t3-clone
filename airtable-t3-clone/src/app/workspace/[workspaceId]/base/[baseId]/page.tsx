import Link from "next/link";
import { AppLayout } from "~/app/_components/app-layout";
import { api } from "~/trpc/server";
import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";

function ActionCard({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--border)] hover:shadow-sm"
      type="button"
    >
      <div className="mb-3 text-2xl">{icon}</div>
      <div className="text-base font-semibold text-[var(--fg)]">{title}</div>
      <div className="mt-1 text-sm text-[var(--muted)]">{subtitle}</div>
    </button>
  );
}

export default async function BaseOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; baseId: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/api/auth/signin");

  const currentUser = {
    name: session.user?.name ?? "User",
    avatarUrl: session.user?.image ?? undefined,
  };

  const { workspaceId, baseId } = await params;

  const workspace = await api.workspace.get({ workspaceId });
  const bases = workspace.bases.map((b) => ({ id: b.id, name: b.name }));
  
  const tablesRaw = await api.table.list({ baseId });
  const tables = tablesRaw.map((t) => ({ id: t.id, name: t.name }));

  const baseName = bases.find((b) => b.id === baseId)?.name ?? "Base";

  const header = (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: page title */}
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--fg)]">{baseName}</span>
        </div>

        {/* Right: share */}
        <button
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          type="button"
        >
          Share
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { label: "Overview", href: `/workspace/${workspaceId}/base/${baseId}` },
          { label: "Members", href: `/workspace/${workspaceId}/base/${baseId}/members` },
          { label: "Permissions", href: `/workspace/${workspaceId}/base/${baseId}/permissions` },
          { label: "Data Sources", href: `/workspace/${workspaceId}/base/${baseId}/data-sources`, badge: 1 },
          { label: "Syncs", href: `/workspace/${workspaceId}/base/${baseId}/syncs` },
          { label: "Settings", href: `/workspace/${workspaceId}/base/${baseId}/settings` },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              t.label === "Overview"
                ? "bg-[var(--surface)] text-[var(--fg)] border border-[var(--border-soft)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
            ].join(" ")}
          >
            {t.label}
            {typeof t.badge === "number" ? (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
                {t.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout
      workspace={{ id: workspace.id, name: workspace.name }}
      bases={bases}
      tables={tables}
      currentBaseId={baseId}
      currentUser={currentUser}
      header={header}
    >
      <div className="p-6">
        <div className="mb-4 text-lg font-semibold text-[var(--fg)]">Actions</div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            icon="➕"
            title="Create New Table"
            subtitle="Start from scratch."
          />
          <ActionCard
            icon="⬇️"
            title="Import Data"
            subtitle="From files & external sources."
          />
          <ActionCard
            icon="🔌"
            title="Connect External Data"
            subtitle="In realtime to external databases."
          />
          <ActionCard
            icon="⚡"
            title="Sync data"
            subtitle="With internal or external sources."
          />
          <ActionCard
            icon="🧩"
            title="Create Empty Script"
            subtitle="Start from scratch."
          />
          <ActionCard
            icon="📜"
            title="Scripts"
            subtitle="Ready-to-use scripts."
          />
          <ActionCard
            icon="📊"
            title="Create Empty Dashboard"
            subtitle="Start from scratch."
          />
        </div>
      </div>
    </AppLayout>
  );
}