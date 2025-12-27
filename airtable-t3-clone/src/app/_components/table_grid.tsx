"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "~/trpc/react";

// ✅ Drag/drop
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
        className="w-full px-2 py-2 text-left font-semibold hover:bg-white/5"
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
      className="w-full bg-white/10 px-2 py-2 outline-none"
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

function SortableHeader({
  colId,
  selected,
  onSelect,
  children,
}: {
  colId: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: colId });

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className={[
        "min-w-[180px] rounded-md",
        selected ? "bg-white/10 ring-2 ring-white/50" : "hover:bg-white/5",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>

        {/* drag handle */}
        <button
          type="button"
          className="cursor-grab px-2 py-2 text-white/60 hover:text-white"
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </div>
    </div>
  );
}

export function TableGrid({ baseId, tableId }: Props) {
  const PAGE_SIZE = 100;

  // chunked add 100k rows (kept)
  const ADD_TOTAL = 100_000;
  const CHUNK_SIZE = 5_000;

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

  // Column add UI (kept)
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

  // Rename column (kept)
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

  // ✅ Column select + delete (matches recommendation)
  const [selectedColumnId, setSelectedColumnId] = React.useState<string | null>(
    null,
  );

  const deleteColMut = api.table.deleteColumn.useMutation({
    onSuccess: async () => {
      setSelectedColumnId(null);
      await utils.table.getMeta.invalidate({ baseId, tableId });
      await utils.table.rowsInfinite.invalidate({ baseId, tableId, limit: PAGE_SIZE });
    },
  });

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedColumnId) return;

      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          (t as HTMLElement).isContentEditable);

      if (typing) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        deleteColMut.mutate({ baseId, tableId, columnId: selectedColumnId });
      }

      if (e.key === "Escape") setSelectedColumnId(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedColumnId, deleteColMut, baseId, tableId]);

  // ✅ Drag/drop reorder (matches recommendation)
  // NOTE: this expects you have `api.table.reorderColumns` implemented on the backend.
  const reorderMut = api.table.reorderColumns.useMutation({
    onSuccess: async () => {
      await utils.table.getMeta.invalidate({ baseId, tableId });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragEnd = (evt: DragEndEvent) => {
    const activeId = String(evt.active.id);
    const overId = evt.over?.id ? String(evt.over.id) : null;
    if (!overId || activeId === overId) return;

    const cols = meta.data?.columns ?? [];
    const ids = cols.map((c) => c.id);

    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextCols = arrayMove(cols, oldIndex, newIndex);

    // optimistic reorder
    utils.table.getMeta.setData({ baseId, tableId }, (old) => {
      if (!old) return old;
      return { ...old, columns: nextCols };
    });

    reorderMut.mutate({
      baseId,
      tableId,
      orderedColumnIds: nextCols.map((c) => c.id),
    });
  };

  // Editable cells (kept)
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
          className="w-full px-2 py-2 text-left hover:bg-white/5"
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

  // Add rows (chunked) – kept
  const addRowsMut = api.table.addRows.useMutation();

  const handleAdd100k = async () => {
    setAddErr(null);
    setAddProgress(0);

    try {
      let remaining = ADD_TOTAL;

      while (remaining > 0) {
        const n = Math.min(CHUNK_SIZE, remaining);
        await addRowsMut.mutateAsync({ baseId, tableId, count: n });
        remaining -= n;
        setAddProgress((prev) => prev + n);
      }

      await utils.table.getMeta.invalidate({ baseId, tableId });
      await utils.table.rowsInfinite.invalidate({ baseId, tableId, limit: PAGE_SIZE });
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
      await utils.table.rowsInfinite.invalidate({ baseId, tableId, limit: PAGE_SIZE });
    },
  });

  // flatten + map rows
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

  // virtual scrolling
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 20,
  });

  const loadedRowCount = data.length;
  const totalRowCount = meta.data?.rowCount ?? 0;

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastVirtualIndex = virtualItems.at(-1)?.index ?? -1;

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

  const cols = meta.data?.columns ?? [];
  const colIds = cols.map((c) => c.id);

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

          <button
            className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
            disabled={!selectedColumnId || deleteColMut.isPending}
            onClick={() => {
              if (!selectedColumnId) return;
              deleteColMut.mutate({ baseId, tableId, columnId: selectedColumnId });
            }}
          >
            Delete column
          </button>
        </div>
      </div>

      {addErr && <div className="mb-3 text-red-300">Add rows failed: {addErr}</div>}

      {/* ✅ header: click to select, drag handle to reorder, dbl click to rename */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
          <div className="mb-2 flex gap-3 text-white/90">
            {cols.map((c) => (
              <SortableHeader
                key={c.id}
                colId={c.id}
                selected={selectedColumnId === c.id}
                onSelect={() => setSelectedColumnId(c.id)}
              >
                <EditableHeader
                  value={c.name}
                  isSaving={renameColMut.isPending}
                  onCommit={(next) =>
                    renameColMut.mutate({ baseId, tableId, columnId: c.id, name: next })
                  }
                />
              </SortableHeader>
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
            const row = data[vRow.index];
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
                {cols.map((c) => (
                  <div key={c.id} className="min-w-[180px] border-r border-white/5">
                    <EditableCell
                      value={row.cellMap[c.id]}
                      columnType={c.type}
                      isSaving={setCellMut.isPending}
                      onCommit={(next) =>
                        setCellMut.mutate({
                          baseId,
                          tableId,
                          rowId: row.id,
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
