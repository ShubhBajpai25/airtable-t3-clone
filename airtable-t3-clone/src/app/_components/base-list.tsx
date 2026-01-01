"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

// Styled BaseList with Airtable aesthetics
export function BaseList() {
  const utils = api.useUtils();
  const { data, isLoading, error } = api.base.list.useQuery();

  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createBase = api.base.create.useMutation({
    onSuccess: async () => {
      setName("");
      setIsCreating(false);
      await utils.base.list.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading workspaces...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-600 dark:text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="border-b bg-white px-8 py-6 dark:bg-gray-900 dark:border-gray-800">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Workspaces
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Create and manage your workspaces
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-8 py-8">
        {/* Create New Base Card */}
        <div className="mb-6">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="group flex items-center gap-4 rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 transition-all hover:border-blue-400 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600 dark:hover:bg-gray-800"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-2xl dark:bg-blue-900/30">
                ➕
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                  Create new workspace
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Start organizing your data
                </div>
              </div>
            </button>
          ) : (
            <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
                Create new workspace
              </h3>
              <div className="flex gap-3">
                <input
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-600"
                  placeholder="Workspace name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      createBase.mutate({ name: name.trim() });
                    }
                    if (e.key === "Escape") {
                      setIsCreating(false);
                      setName("");
                    }
                  }}
                  autoFocus
                />
                <button
                  className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
                  disabled={!name.trim() || createBase.isPending}
                  onClick={() => createBase.mutate({ name: name.trim() })}
                >
                  {createBase.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={() => {
                    setIsCreating(false);
                    setName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bases Grid */}
        {data && data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((base) => (
              <Link
                key={base.id}
                href={`/base/${base.id}`}
                className="group rounded-lg border bg-white p-6 shadow-sm transition-all hover:shadow-airtable-hover hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-2xl text-white">
                  📁
                </div>
                <h3 className="mb-2 font-semibold text-gray-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                  {base.name}
                </h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(base.updatedAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          !isCreating && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-6xl">📂</div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                No workspaces yet
              </h3>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                Create your first workspace to get started
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// Styled TableList with Airtable aesthetics
export function TableList({ baseId }: { baseId: string }) {
  const utils = api.useUtils();
  const { data, isLoading, error } = api.table.list.useQuery({ baseId });

  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createTable = api.table.create.useMutation({
    onSuccess: async () => {
      setName("");
      setIsCreating(false);
      await utils.table.list.invalidate({ baseId });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading tables...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-600 dark:text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="border-b bg-white px-8 py-6 dark:bg-gray-900 dark:border-gray-800">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Tables
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage tables in this workspace
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-8 py-8">
        {/* Create New Table Card */}
        <div className="mb-6">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="group flex items-center gap-4 rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 transition-all hover:border-blue-400 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600 dark:hover:bg-gray-800"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-2xl dark:bg-green-900/30">
                ➕
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                  Create new table
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Add a new table to organize your data
                </div>
              </div>
            </button>
          ) : (
            <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
                Create new table
              </h3>
              <div className="flex gap-3">
                <input
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-500 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                  placeholder="Table name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      createTable.mutate({
                        baseId,
                        name: name.trim(),
                        seedRows: 500,
                      });
                    }
                    if (e.key === "Escape") {
                      setIsCreating(false);
                      setName("");
                    }
                  }}
                  autoFocus
                />
                <button
                  className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!name.trim() || createTable.isPending}
                  onClick={() =>
                    createTable.mutate({
                      baseId,
                      name: name.trim(),
                      seedRows: 500,
                    })
                  }
                >
                  {createTable.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={() => {
                    setIsCreating(false);
                    setName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tables Grid */}
        {data && data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((table) => (
              <Link
                key={table.id}
                href={`/base/${baseId}/table/${table.id}`}
                className="group rounded-lg border bg-white p-6 shadow-sm transition-all hover:shadow-airtable-hover hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-teal-600 text-2xl text-white">
                  📋
                </div>
                <h3 className="mb-2 font-semibold text-gray-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                  {table.name}
                </h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(table.updatedAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          !isCreating && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-6xl">📋</div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                No tables yet
              </h3>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                Create your first table to get started
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}