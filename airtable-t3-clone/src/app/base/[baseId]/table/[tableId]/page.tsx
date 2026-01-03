import { AppLayout } from "~/app/_components/app-layout";
import { TableGridWrapper } from "~/app/_components/table-grid-wrapper";
import { api } from "~/trpc/server";
import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function TablePage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string }>;
}) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/api/auth/signin");
  }

  const currentUser = {
    name: session.user?.name ?? "User",
    avatarUrl: session.user?.image ?? undefined,
  };

  const { baseId, tableId } = await params;

  const bases = await api.base.list();
  const tables = await api.table.list({ baseId });
  const views = await api.view.list({ baseId, tableId });

  return (
    <TableGridWrapper
      bases={bases}
      tables={tables}
      views={views}
      currentBaseId={baseId}
      currentTableId={tableId}
      currentUser={currentUser}
    />
  );
}