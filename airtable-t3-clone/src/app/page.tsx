import { AppLayout } from "~/app/_components/app-layout";
import { BaseList } from "~/app/_components/base-list";
import { api } from "~/trpc/server";
import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const bases = await api.base.list();

  // Replace with real auth later
  const session = await getServerAuthSession();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  const currentUser = {
    name: session.user?.name ?? "User",
    avatarUrl: session.user?.image ?? undefined,
  };

  return (
    <AppLayout bases={bases} currentUser={currentUser}>
      <BaseList />
    </AppLayout>
  );
}
