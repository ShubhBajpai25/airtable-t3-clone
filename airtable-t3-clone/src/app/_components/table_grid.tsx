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
  const utils = api.useUtils();

  const meta = api.table.getMeta.useQuery({ baseId, tableId });

  const rowsQ = api.table.rowsInfinite.useInfiniteQuery(
    { baseId, tableId, limit: 100 },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      enabled: meta.isSuccess,
    },
  );

  const addRowsMut = api.table.addRows.useMutation({
    onSuccess: async () => {
      // ✅ invalidate ALL cached pages of the infinite query
      await utils.table.rowsInfinite.invalidate();
      await utils.table.getMeta.invalidate({ baseId, tableId });

      // ✅ force the hook to recompute hasNextPage / nextCursor
      await rowsQ.refetch();
    },
    onError: (e) => {
      console.error(e);
      alert(e.message);
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

  // Add a visible row index column first so you can "see" newly-added blank rows
  const columns = React.useMemo<ColumnDef<(typeof data)[number]>[]>(() => {
    const cols = meta.data?.columns ?? [];

    const idxCol: ColumnDef<(typeof data)[number]> = {
      id: "__rowIndex",
      header: "#",
      cell: ({ row }) => (
        <span className="text-white/60">{row.original.rowIndex}</span>
      ),
    };

    const dynamicCols = cols.map((c) => ({
      id: c.id,
      header: c.name,
      cell: ({ row }: { row: { original: (typeof data)[number] } }) => {
        const v = row.original.cellMap[c.id];
        return <span>{v == null ? "" : String(v)}</span>;
      },
    }));

    return [idxCol, ...dynamicCols];
  }, [meta.data, data]);

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

  const rowCount = table.getRowModel().rows.length;
  const virtualRows = rowVirtualizer.getVirtualItems();

  // Fetch next page when nearing bottom (dependency fixed)
  React.useEffect(() => {
    const last = virtualRows[virtualRows.length - 1];
    if (!last) return;

    if (
      last.index >= rowCount - 10 &&
      rowsQ.hasNextPage &&
      !rowsQ.isFetchingNextPage
    ) {
      void rowsQ.fetchNextPage();
    }
  }, [
    virtualRows,
    rowCount,
    rowsQ.hasNextPage,
    rowsQ.isFetchingNextPage,
    rowsQ.fetchNextPage,
  ]);

  if (meta.isLoading) return <p>Loading table…</p>;
  if (meta.error) return <p className="text-red-300">{meta.error.message}</p>;

  return (
    <div className="rounded-xl bg-white/5 p-3">
      {/* actions */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-white/80">
          Rows (DB):{" "}
          <span className="font-semibold">{meta.data?.rowCount ?? 0}</span>
          <span className="ml-4 text-white/50">
            Loaded: {rowCount}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-md bg-white/15 px-4 py-2 font-semibold hover:bg-white/25 disabled:opacity-50"
            disabled={addRowsMut.isPending}
            onClick={() => addRowsMut.mutate({ baseId, tableId, count: 10_000 })}
          >
            {addRowsMut.isPending ? "Adding…" : "Add 10k rows"}
          </button>

          <button
            className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
            disabled={addRowsMut.isPending}
            onClick={() => addRowsMut.mutate({ baseId, tableId, count: 100_000 })}
          >
            {addRowsMut.isPending ? "Adding…" : "Add 100k rows"}
          </button>
        </div>
      </div>

      {/* header */}
      <div className="mb-2 flex gap-3 text-white/90">
        {/* Row index header */}
        <div className="min-w-[72px] font-semibold text-white/70">#</div>

        {/* Dynamic headers */}
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
          {virtualRows.map((vRow) => {
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
                {/* row index cell */}
                <div className="min-w-[72px] px-2 py-2 text-white/60">
                  {row.original.rowIndex}
                </div>

                {/* data cells */}
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
