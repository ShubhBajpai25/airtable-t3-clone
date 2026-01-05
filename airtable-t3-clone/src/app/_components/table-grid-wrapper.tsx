"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "~/app/_components/app-layout";
import { TableGrid } from "~/app/_components/table_grid";
import { ViewControls } from "~/app/_components/view_controls";
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
  workspace: { id: string; name: string };
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
  workspace,
  bases,
  tables,
  views: initialViews,
  currentBaseId,
  currentTableId,
  currentUser,
}: TableGridWrapperProps) {
  const [viewModalTrigger, setViewModalTrigger] = useState(0);
  const [currentViewId, setCurrentViewId] = useState<string | undefined>(
    initialViews[0]?.id
  );

  const viewsQuery = api.view.list.useQuery({
    baseId: currentBaseId,
    tableId: currentTableId,
  });

  const viewGetQuery = api.view.get.useQuery(
    {
      baseId: currentBaseId,
      tableId: currentTableId,
      viewId: currentViewId ?? "",
    },
    { enabled: !!currentViewId }
  );

  const metaQuery = api.table.getMeta.useQuery({
    baseId: currentBaseId,
    tableId: currentTableId,
  });

  const createViewMutation = api.view.create.useMutation();
  const updateConfigMutation = api.view.updateConfig.useMutation();

  // Set first view as current when views load
  useEffect(() => {
    if (!currentViewId && viewsQuery.data?.length) {
      setCurrentViewId(viewsQuery.data[0]!.id);
    }
  }, [currentViewId, viewsQuery.data]);

  // Get names for breadcrumb
  const currentBase = bases.find((b) => b.id === currentBaseId);
  const currentTable = tables.find((t) => t.id === currentTableId);

  return (
    <AppLayout
      workspace={workspace}
      bases={bases}
      tables={tables}
      views={viewsQuery.data ?? initialViews}
      currentBaseId={currentBaseId}
      currentTableId={currentTableId}
      currentViewId={currentViewId}
      currentUser={currentUser}
      onCreateView={(type) => {
        if (type === "GRID") setViewModalTrigger((prev) => prev + 1);
      }}
    >
      <div className="flex h-full min-h-0 flex-col bg-gray-50 dark:bg-gray-950">
        {/* Header with Breadcrumb and ViewControls */}
        <div className="border-b bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-4">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{workspace.name}</span>
              <span>›</span>
              <span>{currentBase?.name ?? "Base"}</span>
              <span>›</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {currentTable?.name ?? "Table"}
              </span>
            </div>

            {/* View Controls for managing views */}
            <ViewControls
              baseId={currentBaseId}
              tableId={currentTableId}
              viewId={currentViewId}
              onSelectView={(next) => setCurrentViewId(next)}
              views={(viewsQuery.data ?? initialViews).map((v) => ({
                id: v.id,
                name: v.name,
              }))}
              viewsLoading={viewsQuery.isLoading}
              currentConfig={viewGetQuery.data?.config}
              configLoading={viewGetQuery.isLoading}
              columns={metaQuery.data?.columns ?? []}
              onChangedView={() => {
                // Refetch when view changes
                void viewGetQuery.refetch();
              }}
              onConfigSaved={() => {
                // Refetch data when config is saved
                void viewGetQuery.refetch();
              }}
            />
          </div>
        </div>

        {/* Table Grid - pass viewId to enable filtering */}
        <div className="min-h-0 flex-1 p-6">
          <div className="h-full min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <TableGrid
              baseId={currentBaseId}
              tableId={currentTableId}
              viewId={currentViewId}
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
                      direction:
                        config.sortDirection === "ASC" ? "asc" : "desc",
                    };
                  }

                  await updateConfigMutation.mutateAsync({
                    baseId: currentBaseId,
                    tableId: currentTableId,
                    viewId: newView.id,
                    patch: configPatch,
                  });

                  // Refetch views and set as current
                  await viewsQuery.refetch();
                  setCurrentViewId(newView.id);
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