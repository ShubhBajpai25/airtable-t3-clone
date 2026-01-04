"use client";

import { useState } from "react";
import { AppLayout } from "~/app/_components/app-layout";
import { TableGrid } from "~/app/_components/table_grid";
import { api } from "~/trpc/react";

type Base = { id: string; name: string };
type Table = { id: string; name: string };

type View = {
  id: string;
  name: string;
  type: "GRID" | "GALLERY";
  createdAt: Date;
  updatedAt: Date;
};

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

  const viewsQuery = api.view.list.useQuery({
    baseId: currentBaseId,
    tableId: currentTableId,
  });

  const createViewMutation = api.view.create.useMutation();
  const updateConfigMutation = api.view.updateConfig.useMutation();

  return (
    <AppLayout
      bases={bases}
      tables={tables}
      views={viewsQuery.data ?? initialViews}
      currentBaseId={currentBaseId}
      currentTableId={currentTableId}
      currentUser={currentUser}
      onCreateView={(type) => {
        if (type === "GRID") setViewModalTrigger((prev) => prev + 1);
      }}
    >
      {/* Key: make this a real flex column with min-h-0 so the scroll child can shrink */}
      <div className="flex h-full min-h-0 flex-col bg-gray-50 dark:bg-gray-950">
        <div className="border-b bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Workspace</span>
            <span>›</span>
            <span className="font-semibold text-gray-900 dark:text-white">Table</span>
          </div>
        </div>

        {/* Key: this must be min-h-0 and flex-1 so TableGrid gets a constrained height */}
        <div className="min-h-0 flex-1 p-6">
          {/* Optional: if you want the grid to have its own rounded panel */}
          <div className="h-full min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <TableGrid
              baseId={currentBaseId}
              tableId={currentTableId}
              viewModalTrigger={viewModalTrigger}
              onViewCreated={async (config) => {
                try {
                  const newView = await createViewMutation.mutateAsync({
                    baseId: currentBaseId,
                    tableId: currentTableId,
                    name: config.name,
                  });

                  const configPatch: {
                    hiddenColumnIds: string[];
                    sort?: { columnId: string; direction: "asc" | "desc" };
                  } = {
                    hiddenColumnIds: config.hiddenColumns,
                  };

                  if (config.sortColumn) {
                    configPatch.sort = {
                      columnId: config.sortColumn,
                      direction: config.sortDirection === "ASC" ? "asc" : "desc",
                    };
                  }

                  await updateConfigMutation.mutateAsync({
                    baseId: currentBaseId,
                    tableId: currentTableId,
                    viewId: newView.id,
                    patch: configPatch,
                  });

                  await viewsQuery.refetch();
                } catch (error) {
                  console.error("Failed to create view:", error);
                }
              }}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
