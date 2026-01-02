import { AppLayout } from "~/app/_components/app-layout";
import { BaseList } from "~/app/_components/base-list";
import { api } from "~/trpc/server";
import { ThemeDebug } from "./_components/theme-debug";

export default async function HomePage() {
  const bases = await api.base.list();
  
  return (
    <>
      {/* Debug panel - will appear as a fixed overlay in top-right */}
      <ThemeDebug />
      
      {/* Your normal page content */}
      <AppLayout bases={bases}>
        <BaseList />
      </AppLayout>
    </>
  );
}