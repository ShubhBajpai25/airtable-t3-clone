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
  const ADD_TOTAL = 100_000;
  const CHUNK_SIZE = 5_000; // <— safe chunk size; reduce to 1_000 if still timing out

  const utils = api.useUtils();

  const [addProgress, setAddProgress] = React.useState(0);
  const [addErr, setAddErr] = React.useState<string | null>(null);

  const meta = api.table.getMeta.useQuery({ baseId, tableId });

  const rowsQ = api.table.rowsInfinite.useInfiniteQuery(
    { baseId, tableId, limit: PAGE_SIZE },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      enabled: meta.isSuccess,
    },
  );

  const addRowsMut = api.table.addRows.useMutation();

  const handleAdd100k = async () => {
    setAddErr(null);
    setAddProgress(0);

    try {
      let remaining = ADD_TOTAL;

      while (remaining > 0) {
        const n = Math.min(CHUNK_SIZE, remaining);

        // each call inserts n blank rows, fast enough to not time out
        await addRowsMut.mutateAsync({ baseId, tableId, count: n });

        remaining -= n;
        setAddProgress(ADD_TOTAL - remaining);
      }

      // refresh counts + paging state once at the end
      await utils.table.getMeta.invalidate({ baseId, tableId });
      await utils.table.rowsInfinite.invalidate({ baseId, tableId, limit: PAGE_SIZE });

      // optional: refetch immediately so the UI reflects the new rowCount right away
      void meta.refetch();
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : String(e));
    }
  };

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
      cell: ({ row }) => <span>{String(row.original.cellMap[c.id] ?? "")}</span>,
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

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastVirtualItem = virtualItems[virtualItems.length - 1];
  const lastVirtualIndex = lastVirtualItem?.index ?? -1;

  React.useEffect(() => {
    if (lastVirtualIndex < 0) return;

    if (
      lastVirtualIndex >= loadedRowCount - 10 &&
      rowsQ.hasNextPage &&
      !rowsQ.isFetchingNextPage
    ) {
      void rowsQ.fetchNextPage();
    }
  }, [
    lastVirtualIndex,
    loadedRowCount,
    rowsQ.hasNextPage,
    rowsQ.isFetchingNextPage,
    rowsQ.fetchNextPage,
  ]);

  if (meta.isLoading) return <p>Loading table…</p>;
  if (meta.error) return <p className="text-red-300">{meta.error.message}</p>;

  const lastLoadedRowIndex = flatRows.at(-1)?.rowIndex;

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
          <span className="font-semibold">{lastLoadedRowIndex ?? "—"}</span>
          {addProgress > 0 && (
            <>
              <span className="mx-2 text-white/40">•</span>
              Added: <span className="font-semibold">{addProgress}</span>
            </>
          )}
        </div>

        <button
          className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
          disabled={addRowsMut.isPending}
          onClick={handleAdd100k}
        >
          {addRowsMut.isPending ? "Adding…" : "Add 100k rows"}
        </button>
      </div>

      {addErr && <div className="mb-3 text-red-300">Add rows failed: {addErr}</div>}

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
