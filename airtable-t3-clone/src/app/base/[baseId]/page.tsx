import { AppLayout } from "~/components/app-layout";
import { TableList } from "~/components/table-list";
import { api } from "~/trpc/server";

export default async function BasePage({ params }: { params: { baseId: string } }) {
  const bases = await api.base.list();
  const tables = await api.table.list({ baseId: params.baseId });
  
  return (
    <AppLayout bases={bases} tables={tables} currentBaseId={params.baseId}>
      <TableList baseId={params.baseId} />
    </AppLayout>
  );
}