import { TableGridWrapper } from "~/app/_components/table-grid-wrapper";
import { api } from "~/trpc/server";
import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function TablePage({
  params,
}: {
  params: Promise<{ workspaceId: string; baseId: string; tableId: string }>;
}) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/api/auth/signin");
  }

  const currentUser = {
    name: session.user?.name ?? "User",
    avatarUrl: session.user?.image ?? undefined,
  };

  const { workspaceId, baseId, tableId } = await params;

  const workspace = await api.workspace.get({ workspaceId });
  const bases = workspace.bases.map((b) => ({ id: b.id, name: b.name }));
  const tables = await api.table.list({ baseId });
  const views = await api.view.list({ baseId, tableId });

  return (
    <TableGridWrapper
      workspace={{ id: workspace.id, name: workspace.name }}
      bases={bases}
      tables={tables}
      views={views}
      currentBaseId={baseId}
      currentTableId={tableId}
      currentUser={currentUser}
    />
  );
}