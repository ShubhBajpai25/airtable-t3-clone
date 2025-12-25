import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { TableList } from "~/app/_components/table-list";

export default async function BasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { baseId } = await params;

  void api.table.list.prefetch({ baseId });

  return (
    <HydrateClient>
      <main className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] p-8 text-white">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <Link href="/" className="text-white/80 hover:text-white">
            ← Back to bases
          </Link>

          <h1 className="text-3xl font-bold">Tables</h1>

          {/* optional debug */}
          {/* <p className="text-white/60">baseId: {baseId}</p> */}

          <TableList baseId={baseId} />
        </div>
      </main>
    </HydrateClient>
  );
}
