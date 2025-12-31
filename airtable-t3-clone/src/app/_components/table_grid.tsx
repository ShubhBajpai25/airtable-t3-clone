"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";

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
const EMPTY_STR_ARR: string[] = [];

type RowDatum = {
  id: string;
  rowIndex: number;
  cellMap: Record<string, string | number | null>;
};

type CellSel = { rowIdx: number; colId: string } | null;

type NavDir = "left" | "right" | "up" | "down" | "tab" | "shiftTab";

type GridMeta = {
  colsById: Record<string, { type: "TEXT" | "NUMBER"; name: string }>;
  selectedCell: CellSel;
  selectedColumnId: string | null;
  isCellSaving: boolean;
  isRenaming: boolean;

  onSelectCell: (rowIdx: number, colId: string) => void;
  onNavigateFrom: (dir: NavDir) => void;
  onCommitCell: (row: RowDatum, colId: string, next: string) => void;

  onSelectColumn: (colId: string) => void;
  onRenameColumn: (colId: string, next: string) => void;
};

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
        "w-[180px] min-w-[180px] rounded-md",
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

function isPrintableKey(e: React.KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return e.key.length === 1;
}

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

  const { onCommit } = props;

  const commit = React.useCallback(() => {
    setEditing(false);
    if (draft !== display) onCommit(draft);
  }, [draft, display, onCommit]);

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
    if (!viewId && viewsQ.data?.length) setViewId(viewsQ.data[0]!.id);
  }, [viewId, viewsQ.data]);

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

  const {
    data: rowsData,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
  } = rowsQ;

  const totalRowCount = meta.data?.rowCount ?? 0;

  const allCols = React.useMemo(() => meta.data?.columns ?? [], [meta.data?.columns]);
  const allColIds = React.useMemo(() => allCols.map((c) => c.id), [allCols]);

  // view hidden ids
  const hiddenColumnIds = React.useMemo(() => {
    const cfg = viewGetQ.data?.config as ViewConfig | undefined;
    return cfg?.hiddenColumnIds ?? EMPTY_STR_ARR;
  }, [viewGetQ.data]);

  const hiddenSet = React.useMemo(() => new Set(hiddenColumnIds), [hiddenColumnIds]);

  // visibility state for TanStack
  const columnVisibility = React.useMemo<VisibilityState>(() => {
    const v: VisibilityState = {};
    for (const c of allCols) v[c.id] = !hiddenSet.has(c.id);
    return v;
  }, [allCols, hiddenSet]);

  // column lookup (for number/text behavior)
  const colById = React.useMemo(() => {
    const m = new Map<string, (typeof allCols)[number]>();
    for (const c of allCols) m.set(c.id, c);
    return m;
  }, [allCols]);

  // colsById for table meta (stable rendering)
  const colsById = React.useMemo(() => {
    const out: Record<string, { type: "TEXT" | "NUMBER"; name: string }> = {};
    for (const c of allCols) out[c.id] = { type: c.type, name: c.name };
    return out;
  }, [allCols]);

  // ---- DB rows -> RowDatum
  const flatRows = React.useMemo(
    () => rowsData?.pages.flatMap((p) => p.rows) ?? [],
    [rowsData],
  );

  const data: RowDatum[] = React.useMemo(() => {
    return flatRows.map((r) => {
      const cellMap: Record<string, string | number | null> = {};
      for (const c of r.cells) {
        cellMap[c.columnId] = c.textValue ?? c.numberValue ?? null;
      }
      return { id: r.id, rowIndex: r.rowIndex, cellMap };
    });
  }, [flatRows]);

  const displayData = showTypingBlank ? [] : data;

  // ---- UI state: add col / selection
  const [addingCol, setAddingCol] = React.useState(false);
  const [newColName, setNewColName] = React.useState("");
  const [newColType, setNewColType] = React.useState<"TEXT" | "NUMBER">("TEXT");

  const [selectedCell, setSelectedCell] = React.useState<CellSel>(null);
  const [selectedColumnId, setSelectedColumnId] = React.useState<string | null>(null);

  // keep selection valid if hidden
  React.useEffect(() => {
    if (selectedColumnId && columnVisibility[selectedColumnId] === false) setSelectedColumnId(null);
    if (selectedCell && columnVisibility[selectedCell.colId] === false) setSelectedCell(null);
  }, [columnVisibility, selectedColumnId, selectedCell]);

  // ---- Column order (TanStack source of truth)
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);

  // initialize / append new columns
  React.useEffect(() => {
    setColumnOrder((prev) => {
      if (prev.length === 0) return allColIds;

      const next = prev.filter((id) => allColIds.includes(id));
      const nextSet = new Set(next);
      for (const id of allColIds) if (!nextSet.has(id)) next.push(id);

      return next;
    });
  }, [allColIds]);

  // visible ids in current columnOrder (used for nav + scroll + DnD list)
  const visibleColIds = React.useMemo(() => {
    const order = columnOrder.length ? columnOrder : allColIds;
    return order.filter((id) => columnVisibility[id] !== false);
  }, [columnOrder, allColIds, columnVisibility]);

  // ---- virtualizer
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

  // default selection on load
  React.useEffect(() => {
    if (showTypingBlank) return;
    if (!selectedCell && !selectedColumnId && displayData.length > 0 && visibleColIds.length > 0) {
      setSelectedCell({ rowIdx: 0, colId: visibleColIds[0]! });
    }
  }, [showTypingBlank, selectedCell, selectedColumnId, displayData.length, visibleColIds]);

  // scroll/focus selected cell
  React.useEffect(() => {
    if (showTypingBlank) return;
    if (!selectedCell) return;

    rowVirtualizer.scrollToIndex(selectedCell.rowIdx, { align: "auto" });

    const colIdx = visibleColIds.indexOf(selectedCell.colId);
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
  }, [showTypingBlank, selectedCell, visibleColIds, rowVirtualizer]);

  // pending selection when loading next page
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

      const maxRowIdx = Math.max(0, (totalRowCount ?? 1) - 1);
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
      if (!selectedCell || visibleColIds.length === 0) return;

      const colIdx = visibleColIds.indexOf(selectedCell.colId);
      const lastColIdx = visibleColIds.length - 1;

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
      navigateTo(r, visibleColIds[c]!);
    },
    [showTypingBlank, selectedCell, visibleColIds, navigateTo],
  );

  // delete selected column via keyboard (when column selected, not a cell)
  const deleteColMut = api.table.deleteColumn.useMutation({
    onSuccess: async () => {
      setSelectedColumnId(null);
      await utils.table.getMeta.invalidate({ baseId, tableId });
      await utils.table.rowsInfinite.invalidate(rowsKey);
    },
  });

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

  // ---- mutations
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

  const reorderMut = api.table.reorderColumns.useMutation({
    onSuccess: async () => {
      await utils.table.getMeta.invalidate({ baseId, tableId });
    },
  });

  const setCellMut = api.table.setCellValue.useMutation({
    onMutate: async (vars) => {
      await utils.table.rowsInfinite.cancel(rowsKey);
      const prev = utils.table.rowsInfinite.getInfiniteData(rowsKey);

      const colType = colById.get(vars.columnId)?.type ?? "TEXT";
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

  // ---- DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // IMPORTANT: DnD updates columnOrder immediately (and also persists to DB)
  const onDragEnd = (evt: DragEndEvent) => {
    const activeId = String(evt.active.id);
    const overId = evt.over?.id ? String(evt.over.id) : null;
    if (!overId || activeId === overId) return;

    const fullOrder = columnOrder.length ? columnOrder : allColIds;
    const visible = fullOrder.filter((id) => columnVisibility[id] !== false);

    const oldIndex = visible.indexOf(activeId);
    const newIndex = visible.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextVisible = arrayMove(visible, oldIndex, newIndex);

    // Rebuild full order, preserving hidden columns at their slots
    const visIter = nextVisible[Symbol.iterator]();
    const nextOrder = fullOrder.map((id) => {
      if (columnVisibility[id] === false) return id;
      return visIter.next().value as string;
    });

    setColumnOrder(nextOrder);

    // optimistic meta.columns update
    const finalCols = nextOrder
      .map((id) => colById.get(id))
      .filter(Boolean) as (typeof allCols)[number][];

    utils.table.getMeta.setData({ baseId, tableId }, (old) => {
      if (!old) return old;
      return { ...old, columns: finalCols };
    });

    reorderMut.mutate({
      baseId,
      tableId,
      orderedColumnIds: nextOrder,
    });
  };

  // ---- infinite fetch trigger
  const loadedRowCount = displayData.length;
  const vItems = rowVirtualizer.getVirtualItems();
  const lastVirtualIndex = vItems.at(-1)?.index ?? -1;

  React.useEffect(() => {
    if (showTypingBlank) return;
    if (lastVirtualIndex < 0) return;
    if (lastVirtualIndex >= loadedRowCount - 10 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [showTypingBlank, lastVirtualIndex, loadedRowCount, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ---- TanStack Table (true renderer)
  const gridMeta = React.useMemo<GridMeta>(
    () => ({
      colsById,
      selectedCell,
      selectedColumnId,
      isCellSaving: setCellMut.isPending,
      isRenaming: renameColMut.isPending,

      onSelectCell: (r, c) => selectCell(r, c),
      onNavigateFrom: (dir) => navigateFrom(dir),
      onCommitCell: (row, colId, next) => {
        setCellMut.mutate({ baseId, tableId, rowId: row.id, columnId: colId, value: next });
      },

      onSelectColumn: (colId) => {
        setSelectedCell(null);
        setSelectedColumnId(colId);
      },
      onRenameColumn: (colId, next) => {
        renameColMut.mutate({ baseId, tableId, columnId: colId, name: next });
      },
    }),
    [
      colsById,
      selectedCell,
      selectedColumnId,
      setCellMut,
      renameColMut,
      selectCell,
      navigateFrom,
      baseId,
      tableId,
    ],
  );

  const columns = React.useMemo<ColumnDef<RowDatum>[]>(
    () =>
      allCols.map((c) => ({
        id: c.id,
        accessorFn: (row) => row.cellMap[c.id] ?? null,

        header: (ctx) => {
          const m = ctx.table.options.meta as GridMeta | undefined;
          const colId = ctx.column.id;
          const name = m?.colsById[colId]?.name ?? "";

          return (
            <SortableHeader
              colId={colId}
              selected={m?.selectedColumnId === colId}
              onSelect={() => m?.onSelectColumn(colId)}
            >
              <EditableHeader
                value={name}
                isSaving={m?.isRenaming ?? false}
                onCommit={(next) => m?.onRenameColumn(colId, next)}
              />
            </SortableHeader>
          );
        },

        cell: (ctx) => {
          const m = ctx.table.options.meta as GridMeta | undefined;
          const rowIdx = ctx.row.index;
          const colId = ctx.column.id;
          const colType = m?.colsById[colId]?.type ?? "TEXT";

          return (
            <div className="w-[180px] min-w-[180px]">
              <EditableCell
                rowIdx={rowIdx}
                colId={colId}
                selected={m?.selectedCell?.rowIdx === rowIdx && m?.selectedCell?.colId === colId}
                value={ctx.getValue() as string | number | null | undefined}
                columnType={colType}
                isSaving={m?.isCellSaving ?? false}
                onSelect={() => m?.onSelectCell(rowIdx, colId)}
                onCommit={(next) => m?.onCommitCell(ctx.row.original, colId, next)}
                onNavigate={(dir) => m?.onNavigateFrom(dir)}
              />
            </div>
          );
        },
      })),
    [allCols],
  );

  const table = useReactTable({
    data: displayData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility,
      columnOrder: columnOrder.length ? columnOrder : allColIds,
    },
    meta: gridMeta,
  });

  const headerGroups = table.getHeaderGroups();
  const tableRows = table.getRowModel().rows;

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]!.start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1]!.end : 0;

  const visibleLeafCols = table.getVisibleLeafColumns();
  const visibleColCount = Math.max(1, visibleLeafCols.length);

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
            void invalidateRows();
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

        {!showTypingBlank && visibleLeafCols.length === 0 && (
          <div className="p-6 text-center text-white/60">
            All columns are hidden in this view.
          </div>
        )}

        {!showTypingBlank && visibleLeafCols.length > 0 && (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <SortableContext items={visibleColIds} strategy={horizontalListSortingStrategy}>
              <table
                className="w-max border-collapse text-white/90"
                style={{ minWidth: `${visibleLeafCols.length * COL_WIDTH}px` }}
              >
                <thead className="sticky top-0 z-10 bg-black/30 backdrop-blur">
                  {headerGroups.map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className="border-b border-white/10 align-top"
                          style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                <tbody>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: paddingTop }} colSpan={visibleColCount} />
                    </tr>
                  )}

                  {virtualRows.map((vRow) => {
                    const row = tableRows[vRow.index];
                    if (!row) return null;

                    return (
                      <tr key={row.id} className="border-b border-white/5">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="border-r border-white/5 align-top"
                            style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: paddingBottom }} colSpan={visibleColCount} />
                    </tr>
                  )}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        )}

        {isFetchingNextPage && !showTypingBlank && (
          <div className="p-3 text-white/60">Loading more…</div>
        )}
      </div>
    </div>
  );
}
