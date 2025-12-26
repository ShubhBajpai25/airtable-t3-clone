"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { api } from "~/trpc/react";

type Props = { baseId: string; tableId: string };

export function TableGrid({ baseId, tableId }: Props) {
  const PAGE_SIZE = 100;
  const utils = api.useUtils();

  const meta = api.table.getMeta.useQuery({ baseId, tableId });

  const rowsQ = api.table.rowsInfinite.useInfiniteQuery(
    { baseId, tableId, limit: PAGE_SIZE },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      enabled: meta.isSuccess,
    },
  );

  const addRowsMut = api.table.addRows.useMutation({
    onSuccess: async () => {
      // refresh total rowCount + infinite paging state (hasNextPage/nextCursor)
      await utils.table.getMeta.invalidate({ baseId, tableId });
      await utils.table.rowsInfinite.invalidate({ baseId, tableId, limit: PAGE_SIZE });
    },
  });

  const flatRows = React.useMemo(
    () => rowsQ.data?.pages.flatMap((p) => p.rows) ?? [],
    [rowsQ.data],
  );

  const data = React.useMemo(() => {
    return flatRows.map((r) => {
      const cellMap: Record<string, string | number | null> = {};
      for (const c of r.cells) {
        cellMap[c.columnId] = c.textValue ?? c.numberValue ?? null;
      }
      return { id: r.id, rowIndex: r.rowIndex, cellMap };
    });
  }, [flatRows]);

  const columns = React.useMemo<ColumnDef<(typeof data)[number]>[]>(() => {
    const cols = meta.data?.columns ?? [];
    return cols.map((c) => ({
      id: c.id,
      header: c.name,
      cell: ({ row }) => {
        const v = row.original.cellMap[c.id];
        return <span>{v == null ? "" : String(v)}</span>;
      },
    }));
  }, [meta.data]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 20,
  });

  const loadedRowCount = table.getRowModel().rows.length;
  const totalRowCount = meta.data?.rowCount ?? 0;

  React.useEffect(() => {
    const vItems = rowVirtualizer.getVirtualItems();
    const last = vItems[vItems.length - 1];
    if (!last) return;

    if (
      last.index >= loadedRowCount - 10 &&
      rowsQ.hasNextPage &&
      !rowsQ.isFetchingNextPage
    ) {
      void rowsQ.fetchNextPage();
    }
  }, [
    rowVirtualizer,
    loadedRowCount,
    rowsQ.hasNextPage,
    rowsQ.isFetchingNextPage,
    rowsQ.fetchNextPage,
  ]);

  if (meta.isLoading) return <p>Loading table…</p>;
  if (meta.error) return <p className="text-red-300">{meta.error.message}</p>;

  const lastLoadedRowIndex = flatRows.at(-1)?.rowIndex ?? null;


  return (
    <div className="rounded-xl bg-white/5 p-3">
      {/* actions + checks */}
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="text-white/80">
          Rows (DB): <span className="font-semibold">{totalRowCount}</span>{" "}
          <span className="mx-2 text-white/40">•</span>
          Loaded: <span className="font-semibold">{loadedRowCount}</span>{" "}
          <span className="mx-2 text-white/40">•</span>
          Last loaded rowIndex:{" "}
          <span className="font-semibold">
            {lastLoadedRowIndex == null ? "—" : lastLoadedRowIndex}
          </span>
        </div>

        <button
          className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
          disabled={addRowsMut.isPending}
          onClick={() => addRowsMut.mutate({ baseId, tableId, count: 100_000 })}
        >
          {addRowsMut.isPending ? "Adding…" : "Add 100k rows"}
        </button>
      </div>

      {/* header */}
      <div className="mb-2 flex gap-3 text-white/90">
        {meta.data!.columns.map((c) => (
          <div key={c.id} className="min-w-[180px] font-semibold">
            {c.name}
          </div>
        ))}
      </div>

      {/* body */}
      <div
        ref={parentRef}
        className="h-[70vh] overflow-auto rounded-md border border-white/10"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const row = table.getRowModel().rows[vRow.index];
            if (!row) return null;

            return (
              <div
                key={row.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vRow.start}px)`,
                }}
                className="flex border-b border-white/5"
              >
                {meta.data!.columns.map((c) => (
                  <div key={c.id} className="min-w-[180px] px-2 py-2">
                    {String(row.original.cellMap[c.id] ?? "")}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {rowsQ.isFetchingNextPage && (
          <div className="p-3 text-white/60">Loading more…</div>
        )}
      </div>
    </div>
  );
}
