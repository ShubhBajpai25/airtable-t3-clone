"use client";

import { useState } from "react";
import { AppLayout } from "~/app/_components/app-layout";
import { TableGrid } from "~/app/_components/table_grid";
import { api } from "~/trpc/react";

type Base = { id: string; name: string };
type Table = { id: string; name: string };
type View = { id: string; name: string; type: "GRID" | "GALLERY" };

type TableGridWrapperProps = {
  bases: Base[];
  tables: Table[];
  views: View[];
  currentBaseId: string;
  currentTableId: string;
  currentUser: {
    name: string;
    avatarUrl?: string;
  };
};

export function TableGridWrapper({
  bases,
  tables,
  views: initialViews,
  currentBaseId,
  currentTableId,
  currentUser,
}: TableGridWrapperProps) {
  const [viewModalTrigger, setViewModalTrigger] = useState(0);

  // Keep views in sync with server
  const viewsQuery = api.view.list.useQuery(
    { baseId: currentBaseId, tableId: currentTableId },
    { initialData: initialViews }
  );

  const createViewMutation = api.view.create.useMutation({
    onSuccess: async () => {
      // Refetch views after creation
      await viewsQuery.refetch();
    },
  });

  return (
    <AppLayout
      bases={bases}
      tables={tables}
      views={viewsQuery.data ?? initialViews}
      currentBaseId={currentBaseId}
      currentTableId={currentTableId}
      currentUser={currentUser}
      onCreateView={(type) => {
        if (type === "GRID") {
          setViewModalTrigger((prev) => prev + 1);
        }
      }}
    >
      <div className="h-full bg-gray-50 dark:bg-gray-950">
        <div className="border-b bg-white px-6 py-4 dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Workspace</span>
            <span>›</span>
            <span className="font-semibold text-gray-900 dark:text-white">Table</span>
          </div>
        </div>

        <div className="p-6">
          <TableGrid
            baseId={currentBaseId}
            tableId={currentTableId}
            viewModalTrigger={viewModalTrigger}
            onViewCreated={(config) => {
              createViewMutation.mutate({
                baseId: currentBaseId,
                tableId: currentTableId,
                name: config.name,
                type: "GRID",
                config: {
                  sortColumn: config.sortColumn,
                  sortDirection: config.sortDirection,
                  hiddenColumnIds: config.hiddenColumns,
                },
              });
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
}