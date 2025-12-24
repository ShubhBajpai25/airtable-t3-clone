"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

export function BaseList() {
  const utils = api.useUtils();
  const { data, isLoading, error } = api.base.list.useQuery();

  const [name, setName] = useState("");

  const createBase = api.base.create.useMutation({
    onSuccess: async () => {
      setName("");
      await utils.base.list.invalidate();
    },
  });

  if (isLoading) return <p>Loading bases…</p>;
  if (error) return <p className="text-red-300">Error: {error.message}</p>;

  return (
    <div className="w-full max-w-xl rounded-xl bg-white/10 p-4">
      <h2 className="mb-3 text-2xl font-bold">Your Bases</h2>

      <div className="mb-4 flex gap-2">
        <input
          className="w-full rounded-md bg-white/10 px-3 py-2 text-white placeholder:text-white/60 outline-none"
          placeholder="New base name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
          disabled={!name.trim() || createBase.isPending}
          onClick={() => createBase.mutate({ name: name.trim() })}
        >
          {createBase.isPending ? "Creating…" : "Create"}
        </button>
      </div>

      <ul className="space-y-2">
        {(data ?? []).map((b) => (
          <li key={b.id} className="rounded-md bg-white/5 p-3 hover:bg-white/10">
            <Link href={`/base/${b.id}`} className="font-semibold">
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
