import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export default async function TablePage({
  params,
}: {
  params: { baseId: string; tableId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  void api.table.getMeta.prefetch({ tableId: params.tableId });

  return (
    <HydrateClient>
      <main className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] p-8 text-white">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <Link href={`/base/${params.baseId}`} className="text-white/80 hover:text-white">
            ← Back to tables
          </Link>

          <h1 className="text-3xl font-bold">Table</h1>
          <p className="text-white/80">baseId: {params.baseId}</p>
          <p className="text-white/80">tableId: {params.tableId}</p>

          <p className="text-white/70">
            Next: TanStack Table + Virtualizer + paginated rows API.
          </p>
        </div>
      </main>
    </HydrateClient>
  );
}