import { AppLayout } from "~/app/_components/app-layout";
import { TableList } from "~/app/_components/table-list";
import { api } from "~/trpc/server";
import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function BasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const session = await getServerAuthSession();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  const { baseId } = await params;

  const bases = await api.base.list();
  const tables = await api.table.list({ baseId });

  return (
    <AppLayout 
      bases={bases} 
      tables={tables}
      currentBaseId={baseId}
    >
      <TableList baseId={baseId} />
    </AppLayout>
  );
}