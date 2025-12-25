import Link from "next/link";
import { redirect } from "next/navigation";
import { TableGrid } from "~/app/_components/table_grid";

import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export default async function TablePage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { baseId, tableId } = await params;

  return (
    <HydrateClient>
      <main className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] p-8 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <Link href={`/base/${baseId}`} className="text-white/80 hover:text-white">
            ← Back to tables
          </Link>

          <h1 className="text-3xl font-bold">Table</h1>
          <TableGrid baseId={baseId} tableId={tableId} />

          <p className="text-white/70">
            Next: TanStack Table + Virtualizer + paginated rows API.
          </p>
        </div>
      </main>
    </HydrateClient>
  );
}
