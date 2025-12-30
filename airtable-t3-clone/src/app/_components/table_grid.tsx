"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "~/trpc/react";
import { ViewControls, type ViewConfig } from "./view_controls";

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

const COL_WIDTH = 180;

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

type CellSel = { rowIdx: number; colId: string } | null;

function isPrintableKey(e: React.KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return e.key.length === 1;
}

type NavDir = "left" | "right" | "up" | "down" | "tab" | "shiftTab";

function navKey(e: React.KeyboardEvent): NavDir | null {
  if (e.key === "ArrowLeft") return "left";
  if (e.key === "ArrowRight") return "right";
  if (e.key === "ArrowUp") return "up";
  if (e.key === "ArrowDown") return "down";
  if (e.key === "Tab") return e.shiftKey ? "shiftTab" : "tab";
  return null;
}

function EditableCell(props: {
  rowIdx: number;
  colId: string;
  selected: boolean;
  value: string | number | null | undefined;
  columnType: "TEXT" | "NUMBER";
  isSaving: boolean;
  onSelect: () => void;
  onCommit: (next: string) => void;
  onNavigate: (dir: NavDir) => void;
}) {
  const display = String(props.value ?? "");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(display);

  React.useEffect(() => {
    if (!editing) setDraft(display);
  }, [display, editing]);

  React.useEffect(() => {
    if (!props.selected && editing) setEditing(false);
  }, [props.selected, editing]);

  const commit = React.useCallback(() => {
    setEditing(false);
    if (draft !== display) props.onCommit(draft);
  }, [draft, display, props.onCommit]);

  const cancel = React.useCallback(() => {
    setEditing(false);
    setDraft(display);
  }, [display]);

  if (!editing) {
    return (
      <button
        type="button"
        data-cell={`${props.rowIdx}:${props.colId}`}
        tabIndex={props.selected ? 0 : -1}
        className={[
          "w-full px-2 py-2 text-left hover:bg-white/5",
          props.selected ? "bg-white/10 ring-2 ring-white/40" : "",
        ].join(" ")}
        onClick={props.onSelect}
        onFocus={props.onSelect}
        onKeyDown={(e) => {
          const nk = navKey(e);
          if (nk) {
            e.preventDefault();
            props.onNavigate(nk);
            return;
          }

          if (e.key === "Enter") {
            e.preventDefault();
            setEditing(true);
            return;
          }

          if (e.key === "Backspace" || e.key === "Delete") {
            e.preventDefault();
            setEditing(true);
            setDraft("");
            return;
          }

          if (isPrintableKey(e)) {
            e.preventDefault();
            setEditing(true);
            setDraft(e.key);
          }
        }}
      >
        {display}
      </button>
    );
  }

  return (
    <input
      autoFocus
      disabled={props.isSaving}
      className="w-full bg-transparent px-2 py-2 outline-none ring-2 ring-white/40"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit()}
      onKeyDown={(e) => {
        const nk = navKey(e);
        if (nk) {
          e.preventDefault();
          commit();
          props.onNavigate(nk);
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
          return;
        }
      }}
      inputMode={props.columnType === "NUMBER" ? "decimal" : "text"}
    />
  );
}

export function TableGrid({ baseId, tableId }: Props) {
  const PAGE_SIZE = 100;
  const ADD_TOTAL = 100_000;
  const CHUNK_SIZE = 5_000;

  const utils = api.useUtils();

  const [draftQuery, setDraftQuery] = React.useState("");
  const [activeQuery, setActiveQuery] = React.useState<string | undefined>(undefined);
  const isTypingSearch = draftQuery !== (activeQuery ?? "");
  const showTypingBlank = draftQuery.trim().length > 0 && isTypingSearch;

  const [addProgress, setAddProgress] = React.useState(0);
  const [addErr, setAddErr] = React.useState<string | null>(null);

  const meta = api.table.getMeta.useQuery({ baseId, tableId });

  const viewsQ = api.view.list.useQuery({ baseId, tableId });
  const [viewId, setViewId] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!viewId && viewsQ.data?.length) {
      setViewId(viewsQ.data[0]!.id);
    }
  }, [viewId, viewsQ.data]);

  // fetch selected view config (needed for hidden columns + saved sort/filters)
  const viewGetQ = api.view.get.useQuery(
    { baseId, tableId, viewId: viewId ?? "" },
    { enabled: !!viewId },
  );

  const rowsKey = React.useMemo(
    () => ({
      baseId,
      tableId,
      ...(viewId ? { viewId } : {}),
      limit: PAGE_SIZE,
      q: activeQuery?.trim() ? activeQuery.trim() : undefined,
    }),
    [baseId, tableId, viewId, PAGE_SIZE, activeQuery],
  );

    const invalidateRows = React.useCallback(async () => {
    await utils.table.rowsInfinite.invalidate(rowsKey);
  }, [utils.table.rowsInfinite, rowsKey]);

  const rowsQ = api.table.rowsInfinite.useInfiniteQuery(rowsKey, {
  getNextPageParam: (last) => last.nextCursor ?? undefined,
  enabled: meta.isSuccess,
  });

  // ✅ destructure to avoid eslint "missing rowsQ" deps warnings
  const {
    data: rowsData,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
  } = rowsQ;

  const totalRowCount = meta.data?.rowCount ?? 0;

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


  const [selectedCell, setSelectedCell] = React.useState<CellSel>(null);

  const [selectedColumnId, setSelectedColumnId] = React.useState<string | null>(null);

  const allCols = React.useMemo(() => meta.data?.columns ?? [], [meta.data?.columns]);

  const hiddenColumnIds = (viewGetQ.data?.config as ViewConfig | undefined)?.hiddenColumnIds ?? [];
  const hiddenSet = React.useMemo(() => new Set(hiddenColumnIds), [hiddenColumnIds]);

  // visible columns for this view
  const cols = React.useMemo(() => allCols.filter((c) => !hiddenSet.has(c.id)), [allCols, hiddenSet]);
  const colIds = React.useMemo(() => cols.map((c) => c.id), [cols]);

  // if a selection becomes hidden, clear it
  React.useEffect(() => {
    if (selectedColumnId && hiddenSet.has(selectedColumnId)) setSelectedColumnId(null);
    if (selectedCell && hiddenSet.has(selectedCell.colId)) setSelectedCell(null);
  }, [hiddenSet, selectedColumnId, selectedCell]);


  const deleteColMut = api.table.deleteColumn.useMutation({
    onSuccess: async () => {
      setSelectedColumnId(null);
      await utils.table.getMeta.invalidate({ baseId, tableId });
      await utils.table.rowsInfinite.invalidate(rowsKey); // invalidate all variants (q/no-q)
    },
  });

  const flatRows = React.useMemo(
    () => rowsData?.pages.flatMap((p) => p.rows) ?? [],
    [rowsData],
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

  const displayData = showTypingBlank ? [] : data;

  const pendingSelRef = React.useRef<CellSel>(null);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: displayData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 20,
  });

  const runSearch = () => {
    const next = draftQuery.trim();
    setActiveQuery(next ? next : undefined);

    setSelectedCell(null);
    pendingSelRef.current = null;

    parentRef.current?.scrollTo({ top: 0 });
  };

  const selectCell = React.useCallback((rowIdx: number, colId: string) => {
    setSelectedColumnId(null);
    setSelectedCell({ rowIdx, colId });
  }, []);

  React.useEffect(() => {
    if (showTypingBlank) return;
    if (!selectedCell && !selectedColumnId && displayData.length > 0 && cols.length > 0) {
      setSelectedCell({ rowIdx: 0, colId: cols[0]!.id });
    }
  }, [showTypingBlank, selectedCell, selectedColumnId, displayData.length, cols]);

  React.useEffect(() => {
    if (showTypingBlank) return;
    if (!selectedCell) return;

    rowVirtualizer.scrollToIndex(selectedCell.rowIdx, { align: "auto" });

    const colIdx = cols.findIndex((c) => c.id === selectedCell.colId);
    if (parentRef.current && colIdx >= 0) {
      const targetLeft = colIdx * COL_WIDTH;
      const viewLeft = parentRef.current.scrollLeft;
      const viewRight = viewLeft + parentRef.current.clientWidth;
      const cellLeft = targetLeft;
      const cellRight = targetLeft + COL_WIDTH;

      if (cellLeft < viewLeft) parentRef.current.scrollLeft = cellLeft;
      else if (cellRight > viewRight) {
        parentRef.current.scrollLeft = cellRight - parentRef.current.clientWidth;
      }
    }

    requestAnimationFrame(() => {
      const el = parentRef.current?.querySelector<HTMLElement>(
        `[data-cell="${selectedCell.rowIdx}:${selectedCell.colId}"]`,
      );
      el?.focus();
    });
  }, [showTypingBlank, selectedCell, cols, rowVirtualizer]);

  React.useEffect(() => {
    if (showTypingBlank) return;
    const p = pendingSelRef.current;
    if (!p) return;
    if (p.rowIdx < displayData.length) {
      setSelectedCell(p);
      pendingSelRef.current = null;
    }
  }, [showTypingBlank, displayData.length]);

  const navigateTo = React.useCallback(
    (nextRowIdx: number, nextColId: string) => {
      if (showTypingBlank) return;

      const maxRowIdx = Math.max(0, (totalRowCount || 1) - 1);
      const rowIdx = Math.min(Math.max(0, nextRowIdx), maxRowIdx);

      if (rowIdx >= displayData.length && hasNextPage && !isFetchingNextPage) {
        pendingSelRef.current = { rowIdx, colId: nextColId };
        void fetchNextPage();
        return;
      }

      setSelectedColumnId(null);
      setSelectedCell({
        rowIdx: Math.min(rowIdx, Math.max(0, displayData.length - 1)),
        colId: nextColId,
      });
    },
    [
      showTypingBlank,
      totalRowCount,
      displayData.length,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
    ],
  );

  const navigateFrom = React.useCallback(
    (dir: NavDir) => {
      if (showTypingBlank) return;
      if (!selectedCell || cols.length === 0) return;

      const colIdx = cols.findIndex((c) => c.id === selectedCell.colId);
      const lastColIdx = cols.length - 1;

      let r = selectedCell.rowIdx;
      let c = colIdx < 0 ? 0 : colIdx;

      if (dir === "left") c -= 1;
      if (dir === "right") c += 1;
      if (dir === "up") r -= 1;
      if (dir === "down") r += 1;

      if (dir === "tab") {
        if (c < lastColIdx) c += 1;
        else {
          r += 1;
          c = 0;
        }
      }

      if (dir === "shiftTab") {
        if (c > 0) c -= 1;
        else {
          r -= 1;
          c = lastColIdx;
        }
      }

      c = Math.min(Math.max(0, c), lastColIdx);
      navigateTo(r, cols[c]!.id);
    },
    [showTypingBlank, selectedCell, cols, navigateTo],
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedColumnId) return;
      if (selectedCell) return;

      const t = e.target instanceof HTMLElement ? e.target : null;
      const typing =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        deleteColMut.mutate({ baseId, tableId, columnId: selectedColumnId });
      }

      if (e.key === "Escape") setSelectedColumnId(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedColumnId, selectedCell, deleteColMut, baseId, tableId]);

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

    const visibleIds = cols.map((c) => c.id);
    const oldIndex = visibleIds.indexOf(activeId);
    const newIndex = visibleIds.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextVisible = arrayMove(cols, oldIndex, newIndex);

    // …but preserve hidden columns in their original positions in the full ordering
    const visIter = nextVisible[Symbol.iterator]();
    const finalCols = allCols.map((c) => (hiddenSet.has(c.id) ? c : (visIter.next().value as typeof c)));

    utils.table.getMeta.setData({ baseId, tableId }, (old) => {
      if (!old) return old;
      return { ...old, columns: finalCols };
    });

    reorderMut.mutate({
      baseId,
      tableId,
      orderedColumnIds: finalCols.map((c) => c.id),
    });
  };

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
      await utils.table.rowsInfinite.invalidate(rowsKey);
      void meta.refetch();
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : String(e));
    }
  };

  const setCellMut = api.table.setCellValue.useMutation({
    onMutate: async (vars) => {
      await utils.table.rowsInfinite.cancel(rowsKey);

      const prev = utils.table.rowsInfinite.getInfiniteData(rowsKey);

      const colType = cols.find((c) => c.id === vars.columnId)?.type ?? "TEXT";
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

      utils.table.rowsInfinite.setInfiniteData(rowsKey, (old) => {
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
      });

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.table.rowsInfinite.setInfiniteData(rowsKey, ctx.prev);
    },
    onSettled: async () => {
      await utils.table.rowsInfinite.invalidate(rowsKey);
    },
  });

  const loadedRowCount = displayData.length;
  const vItems = rowVirtualizer.getVirtualItems();
  const lastVirtualIndex = vItems.at(-1)?.index ?? -1;

  React.useEffect(() => {
    if (showTypingBlank) return;
    if (lastVirtualIndex < 0) return;

    if (lastVirtualIndex >= loadedRowCount - 10 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [
    showTypingBlank,
    lastVirtualIndex,
    loadedRowCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  if (meta.isLoading) return <p>Loading table…</p>;
  if (meta.error) return <p className="text-red-300">{meta.error.message}</p>;

  if (rowsQ.isLoading) return <p>Loading rows…</p>;
  if (rowsQ.error) return <p className="text-red-300">{rowsQ.error.message}</p>;

  return (
    <div className="rounded-xl bg-white/5 p-3">
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

        <ViewControls
          baseId={baseId}
          tableId={tableId}
          views={(viewsQ.data ?? []).map((v) => ({ id: v.id, name: v.name }))}
          viewsLoading={viewsQ.isLoading}
          viewId={viewId}
          onSelectView={(next) => setViewId(next)}
          onChangedView={() => {
            setSelectedCell(null);
            setSelectedColumnId(null);
            pendingSelRef.current = null;
            parentRef.current?.scrollTo({ top: 0 });
          }}
          currentConfig={(viewGetQ.data?.config as ViewConfig | undefined) ?? undefined}
          configLoading={viewGetQ.isLoading}
          columns={allCols}
          onConfigSaved={() => {
            // refetch rows so filters/sort apply immediately
            void invalidateRows();
            // scroll to top when view changes
            parentRef.current?.scrollTo({ top: 0 });
          }}
        />

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

          <div className="flex items-center gap-2">
            <input
              className="w-64 rounded-md bg-white/10 px-3 py-2 outline-none"
              placeholder="Search all cells…"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setDraftQuery("");
                  setActiveQuery(undefined);
                  setSelectedCell(null);
                  pendingSelRef.current = null;
                  parentRef.current?.scrollTo({ top: 0 });
                }
              }}
            />

            {draftQuery.trim() && isTypingSearch && (
              <span className="text-sm text-white/60">Press Enter to see results…</span>
            )}

            {activeQuery && (
              <button
                type="button"
                className="rounded-md px-3 py-2 text-white/70 hover:text-white"
                onClick={() => {
                  setDraftQuery("");
                  setActiveQuery(undefined);
                  setSelectedCell(null);
                  pendingSelRef.current = null;
                  parentRef.current?.scrollTo({ top: 0 });
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {addErr && <div className="mb-3 text-red-300">Add rows failed: {addErr}</div>}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
          <div className="mb-2 flex gap-3 text-white/90">
            {cols.map((c) => (
              <SortableHeader
                key={c.id}
                colId={c.id}
                selected={selectedColumnId === c.id}
                onSelect={() => {
                  setSelectedCell(null);
                  setSelectedColumnId(c.id);
                }}
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

      <div ref={parentRef} className="h-[70vh] overflow-auto rounded-md border border-white/10">
        {showTypingBlank && (
          <div className="p-6 text-center text-white/60">
            Press Enter to see results for{" "}
            <span className="text-white">“{draftQuery.trim()}”</span>
          </div>
        )}

        {!showTypingBlank && activeQuery && !isFetching && displayData.length === 0 && (
          <div className="p-6 text-center text-white/60">
            No results for <span className="text-white">“{activeQuery}”</span>
          </div>
        )}

        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const row = displayData[vRow.index];
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
                      rowIdx={vRow.index}
                      colId={c.id}
                      selected={selectedCell?.rowIdx === vRow.index && selectedCell?.colId === c.id}
                      value={row.cellMap[c.id]}
                      columnType={c.type}
                      isSaving={setCellMut.isPending}
                      onSelect={() => selectCell(vRow.index, c.id)}
                      onCommit={(next) =>
                        setCellMut.mutate({
                          baseId,
                          tableId,
                          rowId: row.id,
                          columnId: c.id,
                          value: next,
                        })
                      }
                      onNavigate={navigateFrom}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {isFetchingNextPage && !showTypingBlank && (
          <div className="p-3 text-white/60">Loading more…</div>
        )}
      </div>
    </div>
  );
}
