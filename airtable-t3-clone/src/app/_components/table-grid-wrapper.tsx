"use client";

import { useState } from "react";
import { AppLayout } from "~/app/_components/app-layout";
import { TableGrid } from "~/app/_components/table_grid";
import { api } from "~/trpc/react";

type Base = { id: string; name: string };
type Table = { id: string; name: string };

// Updated View type to match API response
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

  // Keep views in sync with server - let TypeScript infer the type
  const viewsQuery = api.view.list.useQuery(
    { baseId: currentBaseId, tableId: currentTableId }
  );

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
            onViewCreated={async (config) => {
              try {
                // Step 1: Create the view with just the name
                const newView = await createViewMutation.mutateAsync({
                  baseId: currentBaseId,
                  tableId: currentTableId,
                  name: config.name,
                });

                // Step 2: Update the view config with sort and hidden columns
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

                // Refetch views to show the new one
                await viewsQuery.refetch();
              } catch (error) {
                console.error("Failed to create view:", error);
              }
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
}