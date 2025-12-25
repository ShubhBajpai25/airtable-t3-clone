"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

export function TableList({ baseId }: { baseId: string }) {
  const utils = api.useUtils();
  const { data, isLoading, error } = api.table.list.useQuery({ baseId });

  const [name, setName] = useState("");

  const createTable = api.table.create.useMutation({
    onSuccess: async () => {
      setName("");
      await utils.table.list.invalidate({ baseId });
    },
  });

  if (isLoading) return <p>Loading tables…</p>;
  if (error) return <p className="text-red-300">Error: {error.message}</p>;

  return (
    <div className="w-full rounded-xl bg-white/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tables in this base</h2>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          className="w-full rounded-md bg-white/10 px-3 py-2 text-white placeholder:text-white/60 outline-none"
          placeholder="New table name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
          disabled={!name.trim() || createTable.isPending}
          onClick={() =>
            createTable.mutate({
              baseId,
              name: name.trim(),
              seedRows: 500,
            })
          }
        >
          {createTable.isPending ? "Creating…" : "Create"}
        </button>
      </div>

      <ul className="space-y-2">
        {(data ?? []).map((t) => (
          <li key={t.id} className="rounded-md bg-white/5 p-3 hover:bg-white/10">
            <Link href={`/base/${baseId}/table/${t.id}`} className="font-semibold">
              {t.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}