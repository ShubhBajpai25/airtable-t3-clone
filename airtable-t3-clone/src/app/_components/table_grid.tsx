"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";

import { api } from "~/trpc/react";
import { ViewControls, type ViewConfig } from "./view_controls";

import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = { baseId: string; tableId: string };

const COL_WIDTH = 200;
const ROW_HEIGHT = 36;
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

// Toolbar Icons
const FieldsIcon = () => <span className="text-base">☰</span>;
const FilterIcon = () => <span className="text-base">🔽</span>;
const GroupIcon = () => <span className="text-base">▤</span>;
const SortIcon = () => <span className="text-base">↕</span>;
const ColourIcon = () => <span className="text-base">🎨</span>;
const MoreIcon = () => <span className="text-base">⋯</span>;

function ToolbarButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

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
        className="w-full px-3 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-gray-800/50 transition-colors"
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
      className="w-full border-2 border-blue-500 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-blue-600 dark:bg-gray-900 dark:text-white"
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
        opacity: isDragging ? 0.5 : 1,
        width: COL_WIDTH,
        minWidth: COL_WIDTH,
      }}
      className={[
        "group rounded-md border transition-colors",
        selected
          ? "border-blue-500 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-900/10"
          : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/30",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>

        <button
          type="button"
          className="cursor-grab px-2 py-2 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-opacity"
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
          "w-full px-3 py-2 text-left text-sm text-gray-900 transition-colors dark:text-white",
          props.selected
            ? "bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-900/20 dark:ring-blue-600"
            : "hover:bg-gray-50 dark:hover:bg-gray-800/30",
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
        {display || <span className="text-gray-400 dark:text-gray-600">—</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      disabled={props.isSaving}
      className="w-full border-2 border-blue-500 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-blue-600 dark:bg-gray-900 dark:text-white"
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

  const pendingSelRef = React.useRef<CellSel>(null);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const [queryInput, setQueryInput] = React.useState("");
  const [activeQuery, setActiveQuery] = React.useState<string | undefined>(undefined);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);

  const [addingCol, setAddingCol] = React.useState(false);
  const [newColName, setNewColName] = React.useState("");
  const [newColType, setNewColType] = React.useState<"TEXT" | "NUMBER">("TEXT");

  const [selectedCell, setSelectedCell] = React.useState<CellSel>(null);
  const [selectedColumnId, setSelectedColumnId] = React.useState<string | null>(null);

  const clearSearch = React.useCallback(() => {
    setQueryInput("");
    setActiveQuery(undefined);
    setSelectedCell(null);
    setSelectedColumnId(null);
    pendingSelRef.current = null;
    parentRef.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const applySearch = React.useCallback(() => {
    const q = queryInput.trim();
    setActiveQuery(q.length ? q : undefined);
    setSelectedCell(null);
    setSelectedColumnId(null);
    pendingSelRef.current = null;
    parentRef.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [queryInput]);

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
    [baseId, tableId, viewId, activeQuery],
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

  const hiddenColumnIds = React.useMemo(() => {
    const cfg = viewGetQ.data?.config as ViewConfig | undefined;
    return cfg?.hiddenColumnIds ?? EMPTY_STR_ARR;
  }, [viewGetQ.data]);

  const hiddenSet = React.useMemo(() => new Set(hiddenColumnIds), [hiddenColumnIds]);

  const columnVisibility = React.useMemo<VisibilityState>(() => {
    const v: VisibilityState = {};
    for (const c of allCols) v[c.id] = !hiddenSet.has(c.id);
    return v;
  }, [allCols, hiddenSet]);

  const colById = React.useMemo(() => {
    const m = new Map<string, (typeof allCols)[number]>();
    for (const c of allCols) m.set(c.id, c);
    return m;
  }, [allCols]);

  const colsById = React.useMemo(() => {
    const out: Record<string, { type: "TEXT" | "NUMBER"; name: string }> = {};
    for (const c of allCols) out[c.id] = { type: c.type, name: c.name };
    return out;
  }, [allCols]);

  const flatRows = React.useMemo(
    () => rowsData?.pages.flatMap((p) => p.rows) ?? [],
    [rowsData],
  );

  const displayData: RowDatum[] = React.useMemo(() => {
    return flatRows.map((r) => {
      const cellMap: Record<string, string | number | null> = {};
      for (const c of r.cells) {
        cellMap[c.columnId] = c.textValue ?? c.numberValue ?? null;
      }
      return { id: r.id, rowIndex: r.rowIndex, cellMap };
    });
  }, [flatRows]);

  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);

  React.useEffect(() => {
    setColumnOrder((prev) => {
      if (prev.length === 0) return allColIds;

      const next = prev.filter((id) => allColIds.includes(id));
      const nextSet = new Set(next);
      for (const id of allColIds) if (!nextSet.has(id)) next.push(id);

      return next;
    });
  }, [allColIds]);

  const visibleColIds = React.useMemo(() => {
    const order = columnOrder.length ? columnOrder : allColIds;
    return order.filter((id) => columnVisibility[id] !== false);
  }, [columnOrder, allColIds, columnVisibility]);

  React.useEffect(() => {
    if (selectedColumnId && columnVisibility[selectedColumnId] === false) setSelectedColumnId(null);
    if (selectedCell && columnVisibility[selectedCell.colId] === false) setSelectedCell(null);
  }, [columnVisibility, selectedColumnId, selectedCell]);

  const rowVirtualizer = useVirtualizer({
    count: displayData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const selectCell = React.useCallback((rowIdx: number, colId: string) => {
    setSelectedColumnId(null);
    setSelectedCell({ rowIdx, colId });
  }, []);

  React.useEffect(() => {
    if (isSearchFocused) return;
    if (selectedCell || selectedColumnId) return;
    if (displayData.length === 0) return;
    if (visibleColIds.length === 0) return;

    setSelectedCell({ rowIdx: 0, colId: visibleColIds[0]! });
  }, [isSearchFocused, selectedCell, selectedColumnId, displayData.length, visibleColIds]);

  React.useEffect(() => {
    if (isSearchFocused) return;
    if (!selectedCell) return;
    if (selectedCell.rowIdx < 0 || selectedCell.rowIdx >= displayData.length) return;

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
  }, [isSearchFocused, selectedCell, visibleColIds, rowVirtualizer, displayData.length]);

  React.useEffect(() => {
    const p = pendingSelRef.current;
    if (!p) return;
    if (p.rowIdx < displayData.length) {
      setSelectedCell(p);
      pendingSelRef.current = null;
    }
  }, [displayData.length]);

  const navigateTo = React.useCallback(
    (nextRowIdx: number, nextColId: string) => {
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
    [totalRowCount, displayData.length, hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  const navigateFrom = React.useCallback(
    (dir: NavDir) => {
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
    [selectedCell, visibleColIds, navigateTo],
  );

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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

    const visIter = nextVisible[Symbol.iterator]();
    const nextOrder = fullOrder.map((id) => {
      if (columnVisibility[id] === false) return id;
      return visIter.next().value!;
    });

    setColumnOrder(nextOrder);

    const finalCols = nextOrder
      .map((id) => colById.get(id))
      .filter((c): c is (typeof allCols)[number] => Boolean(c));

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

  const loadedRowCount = displayData.length;
  const vItems = rowVirtualizer.getVirtualItems();
  const lastVirtualIndex = vItems.at(-1)?.index ?? -1;

  React.useEffect(() => {
    if (lastVirtualIndex < 0) return;
    if (!hasNextPage || isFetchingNextPage) return;
    if (loadedRowCount === 0) return;

    if (isFetching && !isFetchingNextPage) return;

    if (lastVirtualIndex >= loadedRowCount - 10) {
      void fetchNextPage();
    }
  }, [
    lastVirtualIndex,
    loadedRowCount,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  const gridMeta: GridMeta = {
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
  };

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
            <div style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}>
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

  if (meta.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-600 dark:text-gray-400">Loading table…</p>
      </div>
    );
  }

  if (meta.error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-600 dark:text-red-400">{meta.error.message}</p>
      </div>
    );
  }

  if (rowsQ.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-600 dark:text-gray-400">Loading rows…</p>
      </div>
    );
  }

  if (rowsQ.error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-600 dark:text-red-400">{rowsQ.error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Airtable-style Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <ToolbarButton>
            <FieldsIcon />
            <span>Fields</span>
          </ToolbarButton>
          <ToolbarButton>
            <FilterIcon />
            <span>Filter</span>
          </ToolbarButton>
          <ToolbarButton>
            <GroupIcon />
            <span>Group</span>
          </ToolbarButton>
          <ToolbarButton>
            <SortIcon />
            <span>Sort</span>
          </ToolbarButton>
          <ToolbarButton>
            <ColourIcon />
            <span>Colour</span>
          </ToolbarButton>

          <div className="mx-2 h-6 w-px bg-gray-200 dark:bg-gray-700" />

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
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2">
            <input
              ref={searchRef}
              className="w-48 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="Search..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applySearch();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  clearSearch();
                }
              }}
            />

            {isFetching && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Searching…</span>
            )}

            {(!!activeQuery || queryInput.length > 0) && (
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                onClick={clearSearch}
              >
                Clear
              </button>
            )}
          </div>

          <ToolbarButton>
            <MoreIcon />
          </ToolbarButton>
        </div>
      </div>

      {/* Column Management Bar */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm dark:border-gray-800 dark:bg-gray-900/50">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <span>Rows: <span className="font-medium text-gray-900 dark:text-white">{totalRowCount}</span></span>
          <span className="text-gray-300 dark:text-gray-700">•</span>
          <span>Loaded: <span className="font-medium text-gray-900 dark:text-white">{loadedRowCount}</span></span>
          {addProgress > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span>Added: <span className="font-medium text-gray-900 dark:text-white">{addProgress}</span></span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!addingCol ? (
            <>
              <button
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                onClick={() => setAddingCol(true)}
              >
                + Add field
              </button>
              <button
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                disabled={addRowsMut.isPending}
                onClick={handleAdd100k}
              >
                {addRowsMut.isPending ? "Adding…" : "Add 100k rows"}
              </button>
              <button
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
                disabled={!selectedColumnId || deleteColMut.isPending}
                onClick={() => {
                  if (!selectedColumnId) return;
                  deleteColMut.mutate({ baseId, tableId, columnId: selectedColumnId });
                }}
              >
                Delete field
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <input
                className="w-36 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="Field name"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
              />
              <select
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                value={newColType}
                onChange={(e) => setNewColType(e.target.value as "TEXT" | "NUMBER")}
              >
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
              </select>

              <button
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
                className="rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
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
        </div>
      </div>

      {addErr && (
        <div className="mx-4 mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          Add rows failed: {addErr}
        </div>
      )}

      {/* Table Container */}
      <div
        ref={parentRef}
        className="scrollbar-light dark:scrollbar-dark flex-1 overflow-auto bg-white dark:bg-gray-900"
      >
        {!!activeQuery && !isFetching && displayData.length === 0 && (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            No results for <span className="font-semibold text-gray-900 dark:text-white">{activeQuery}</span>
          </div>
        )}

        {visibleLeafCols.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            All columns are hidden in this view.
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <SortableContext items={visibleColIds} strategy={horizontalListSortingStrategy}>
              <table
                className="w-max border-collapse text-gray-900 dark:text-white"
                style={{ minWidth: `${visibleLeafCols.length * COL_WIDTH}px` }}
              >
                <thead className="sticky top-0 z-10 bg-gray-50 backdrop-blur dark:bg-gray-800/95">
                  {headerGroups.map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className="border-b border-r border-gray-200 align-top dark:border-gray-700"
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
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50 dark:border-gray-800 dark:hover:bg-gray-800/30">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="border-r border-gray-100 align-top dark:border-gray-800"
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

        {isFetchingNextPage && (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Loading more rows…</div>
        )}
      </div>
    </div>
  );
}