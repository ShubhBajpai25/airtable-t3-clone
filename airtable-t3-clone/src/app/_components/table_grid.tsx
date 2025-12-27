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

export function EditableHeader(props: {
  value: string;
  isSaving: boolean;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(props.value);

  React.useEffect(() => {
    if (!editing) setDraft(props.value);
  }, [props.value, editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== props.value) props.onCommit(next);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="min-w-[180px] px-2 py-2 text-left font-semibold hover:bg-white/5"
        onDoubleClick={() => setEditing(true)}
        title="Double click to rename"
      >
        {props.value}
      </button>
    );
  }

  return (
    <input
      autoFocus
      disabled={props.isSaving}
      className="min-w-[180px] bg-white/10 px-2 py-2 outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(props.value);
        }
      }}
    />
  );
}


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

  const [addingCol, setAddingCol] = React.useState(false);
  const [newColName, setNewColName] = React.useState("");
  const [newColType, setNewColType] = React.useState<"TEXT" | "NUMBER">("TEXT");

  const addColMut = api.table.addColumn.useMutation({
    onSuccess: async () => {
      setAddingCol(false);
      setNewColName("");
      setNewColType("TEXT");
      await utils.table.getMeta.invalidate({ baseId, tableId });
    },
  });

  const renameColMut = api.table.renameColumn.useMutation({
  onMutate: async (vars) => {
    await utils.table.getMeta.cancel({ baseId, tableId });

    const prev = utils.table.getMeta.getData({ baseId, tableId });

    utils.table.getMeta.setData({ baseId, tableId }, (old) => {
      if (!old) return old;
      return {
        ...old,
        columns: old.columns.map((c) =>
          c.id === vars.columnId ? { ...c, name: vars.name } : c,
        ),
      };
    });

    return { prev };
  },
  onError: (_err, _vars, ctx) => {
    if (ctx?.prev) utils.table.getMeta.setData({ baseId, tableId }, ctx.prev);
  },
  onSettled: async () => {
    await utils.table.getMeta.invalidate({ baseId, tableId });
  },
});

const deleteColMut = api.table.deleteColumn.useMutation({
  onSuccess: async () => {
    await utils.table.getMeta.invalidate({ baseId, tableId });
    await utils.table.rowsInfinite.invalidate({ baseId, tableId, limit: PAGE_SIZE });
  },
});

const moveColMut = api.table.moveColumn.useMutation({
  onSuccess: async () => {
    await utils.table.getMeta.invalidate({ baseId, tableId });
  },
});



function EditableCell(props: {
  value: string | number | null | undefined;
  columnType: "TEXT" | "NUMBER";
  onCommit: (next: string) => void;
  isSaving: boolean;
}) {
  const display = String(props.value ?? "");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(display);

  React.useEffect(() => {
    if (!editing) setDraft(display);
  }, [display, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== display) props.onCommit(draft);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="w-full text-left px-2 py-2 hover:bg-white/5"
        onClick={() => setEditing(true)}
      >
        {display}
      </button>
    );
  }

  return (
    <input
      autoFocus
      disabled={props.isSaving}
      className="w-full bg-transparent px-2 py-2 outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(display);
        }
      }}
      inputMode={props.columnType === "NUMBER" ? "decimal" : "text"}
    />
  );
}

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
        setAddProgress((prev) => prev + n);
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

  const setCellMut = api.table.setCellValue.useMutation({
    onMutate: async (vars) => {
      await utils.table.rowsInfinite.cancel({ baseId, tableId, limit: PAGE_SIZE });

      const prev = utils.table.rowsInfinite.getInfiniteData({
        baseId,
        tableId,
        limit: PAGE_SIZE,
      });

      // Find column type from meta (for optimistic shape)
      const colType =
        meta.data?.columns.find((c) => c.id === vars.columnId)?.type ?? "TEXT";

      const trimmed = vars.value.trim();
      const optimistic =
        colType === "TEXT"
          ? { textValue: trimmed === "" ? null : trimmed, numberValue: null }
          : (() => {
              if (trimmed === "") return { textValue: null, numberValue: null };
              const n = Number(trimmed);
              return Number.isNaN(n)
                ? { textValue: null, numberValue: null }
                : { textValue: null, numberValue: n };
            })();

      utils.table.rowsInfinite.setInfiniteData(
        { baseId, tableId, limit: PAGE_SIZE },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              rows: p.rows.map((r) => {
                if (r.id !== vars.rowId) return r;

                const existing = r.cells.find((c) => c.columnId === vars.columnId);
                const nextCells = existing
                  ? r.cells.map((c) =>
                      c.columnId === vars.columnId ? { ...c, ...optimistic } : c,
                    )
                  : [...r.cells, { columnId: vars.columnId, ...optimistic }];

                return { ...r, cells: nextCells };
              }),
            })),
          };
        },
      );

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        utils.table.rowsInfinite.setInfiniteData(
          { baseId, tableId, limit: PAGE_SIZE },
          ctx.prev,
        );
      }
    },
    onSettled: async () => {
      // keep it safe/consistent
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
          {addProgress > 0 && (
            <>
              <span className="mx-2 text-white/40">•</span>
              Added: <span className="font-semibold">{addProgress}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!addingCol ? (
            <button
              className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30"
              onClick={() => setAddingCol(true)}
            >
              + Column
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                className="w-44 rounded-md bg-white/10 px-3 py-2 outline-none"
                placeholder="Column name"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
              />
              <select
                className="rounded-md bg-white/10 px-3 py-2 outline-none"
                value={newColType}
                onChange={(e) => setNewColType(e.target.value as "TEXT" | "NUMBER")}
              >
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
              </select>

              <button
                className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
                disabled={addColMut.isPending}
                onClick={() =>
                  addColMut.mutate({
                    baseId,
                    tableId,
                    name: newColName.trim() || "Field",
                    type: newColType,
                  })
                }
              >
                {addColMut.isPending ? "Adding…" : "Add"}
              </button>

              <button
                className="rounded-md px-3 py-2 text-white/70 hover:text-white"
                onClick={() => {
                  setAddingCol(false);
                  setNewColName("");
                  setNewColType("TEXT");
                }}
              >
                Cancel
              </button>
            </div>
          )}

          <button
            className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
            disabled={addRowsMut.isPending}
            onClick={handleAdd100k}
          >
            {addRowsMut.isPending ? "Adding…" : "Add 100k rows"}
          </button>
        </div>
      </div>

      {addErr && <div className="mb-3 text-red-300">Add rows failed: {addErr}</div>}

      {/* header */}
      <div className="mb-2 flex gap-3 text-white/90">
        {meta.data!.columns.map((c, i) => (
          <div key={c.id} className="min-w-[180px]">
            <EditableHeader
              value={c.name}
              isSaving={renameColMut.isPending}
              onCommit={(next) =>
                renameColMut.mutate({ baseId, tableId, columnId: c.id, name: next })
              }
            />

            <div className="mt-1 flex gap-2 text-xs text-white/70">
              <button
                type="button"
                disabled={i === 0 || moveColMut.isPending}
                onClick={() =>
                  moveColMut.mutate({ baseId, tableId, columnId: c.id, direction: "left" })
                }
                className="hover:text-white disabled:opacity-40"
              >
                ←
              </button>

              <button
                type="button"
                disabled={i === meta.data!.columns.length - 1 || moveColMut.isPending}
                onClick={() =>
                  moveColMut.mutate({ baseId, tableId, columnId: c.id, direction: "right" })
                }
                className="hover:text-white disabled:opacity-40"
              >
                →
              </button>

              <button
                type="button"
                disabled={deleteColMut.isPending}
                onClick={() => deleteColMut.mutate({ baseId, tableId, columnId: c.id })}
                className="ml-auto hover:text-red-300 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
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
                  <div key={c.id} className="min-w-[180px] border-r border-white/5">
                    <EditableCell
                      value={row.original.cellMap[c.id]}
                      columnType={c.type}
                      isSaving={setCellMut.isPending}
                      onCommit={(next) =>
                        setCellMut.mutate({
                          baseId,
                          tableId,
                          rowId: row.original.id,
                          columnId: c.id,
                          value: next,
                        })
                      }
                    />
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
