import { AppLayout } from "~/app/_components/app-layout";
import { BaseList } from "~/app/_components/base-list";
import { api } from "~/trpc/server";

export default async function HomePage() {
  const bases = await api.base.list();
  
  return (
    <AppLayout bases={bases}>
      <BaseList />
    </AppLayout>
  );
}