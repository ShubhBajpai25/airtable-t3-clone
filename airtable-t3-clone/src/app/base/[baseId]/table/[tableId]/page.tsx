import { AppLayout } from "~/app/_components/app-layout";
import { TableGrid } from "~/app/_components/table_grid";
import { api } from "~/trpc/server";
import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function TablePage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string }>; // ✅ Now a Promise
}) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/api/auth/signin");
  }

  const currentUser = {
    name: session.user?.name ?? "User",
    avatarUrl: session.user?.image ?? undefined,
  };
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  const { baseId, tableId } = await params; // ✅ Await the params

  const bases = await api.base.list();
  const tables = await api.table.list({ baseId });

  return (
    <AppLayout 
      bases={bases}
      tables={tables}
      currentBaseId={baseId}
      currentTableId={tableId}
      currentUser={currentUser}
    >
      <div className="h-full bg-gray-50 dark:bg-gray-950">
        <div className="border-b bg-white px-6 py-4 dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Workspace</span>
            <span>›</span>
            <span className="font-semibold text-gray-900 dark:text-white">Table</span>
          </div>
        </div>

        <div className="p-6">
          <TableGrid baseId={baseId} tableId={tableId} />
        </div>
      </div>
    </AppLayout>
  );
}