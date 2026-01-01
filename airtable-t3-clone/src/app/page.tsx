import { AppLayout } from "~/components/app-layout";
import { BaseList } from "~/components/base-list";
import { api } from "~/trpc/server";

export default async function HomePage() {
  const bases = await api.base.list();
  
  return (
    <AppLayout bases={bases}>
      <BaseList />
    </AppLayout>
  );
}