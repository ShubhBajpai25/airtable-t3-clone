"use client";

import * as React from "react";
import { api } from "~/trpc/react";

type Col = { id: string; name: string; type: "TEXT" | "NUMBER" };

type TextOp = "is_empty" | "is_not_empty" | "contains" | "not_contains" | "equals";
type NumOp = "is_empty" | "is_not_empty" | "gt" | "lt" | "equals";

type TextFilter = {
  kind: "text";
  columnId: string;
  op: TextOp;
  value?: string;
};

type NumberFilter = {
  kind: "number";
  columnId: string;
  op: NumOp;
  value?: number;
};

type ViewFilter = TextFilter | NumberFilter;

type ViewSort = { columnId: string; direction: "asc" | "desc" };

export type ViewConfig = {
  filters: ViewFilter[];
  sort?: ViewSort;
  q?: string;
  hiddenColumnIds: string[];
  [k: string]: unknown;
};

const EMPTY_STR_ARR: string[] = [];

function needsValue(op: TextOp | NumOp) {
  return op !== "is_empty" && op !== "is_not_empty";
}

function parseTextOp(v: string): TextOp {
  if (v === "is_empty") return "is_empty";
  if (v === "is_not_empty") return "is_not_empty";
  if (v === "contains") return "contains";
  if (v === "not_contains") return "not_contains";
  return "equals";
}

function parseNumOp(v: string): NumOp {
  if (v === "is_empty") return "is_empty";
  if (v === "is_not_empty") return "is_not_empty";
  if (v === "gt") return "gt";
  if (v === "lt") return "lt";
  return "equals";
}

function parseSortDir(v: string): "asc" | "desc" {
  return v === "desc" ? "desc" : "asc";
}

function defaultConfig(cfg?: Partial<ViewConfig>): ViewConfig {
  return {
    filters: cfg?.filters ?? [],
    sort: cfg?.sort,
    q: cfg?.q,
    hiddenColumnIds: cfg?.hiddenColumnIds ?? [],
  };
}

function firstFilterForColumn(col: Col): ViewFilter {
  if (col.type === "NUMBER") return { kind: "number", columnId: col.id, op: "gt", value: 0 };
  return { kind: "text", columnId: col.id, op: "contains", value: "" };
}

export function ViewControls(props: {
  baseId: string;
  tableId: string;

  viewId?: string;
  onSelectView: (next?: string) => void;

  views: Array<{ id: string; name: string }>;
  viewsLoading: boolean;

  currentConfig?: ViewConfig;
  configLoading: boolean;

  columns: Col[];

  onChangedView?: () => void;
  onConfigSaved?: () => void;
}) {
  const utils = api.useUtils();

  const [panelOpen, setPanelOpen] = React.useState(false);

  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");

  const [renaming, setRenaming] = React.useState(false);
  const [renameDraft, setRenameDraft] = React.useState("");

  const [draft, setDraft] = React.useState<ViewConfig>(() => defaultConfig(props.currentConfig));

  React.useEffect(() => {
    setDraft(defaultConfig(props.currentConfig));
    setCreating(false);
    setNewName("");
    setRenaming(false);
    setRenameDraft("");
  }, [props.viewId, props.currentConfig]);

  const createMut = api.view.create.useMutation();
  const renameMut = api.view.rename.useMutation();
  const deleteMut = api.view.delete.useMutation();
  const updateConfigMut = api.view.updateConfig.useMutation();

  const canDelete = props.views.length > 1;

  const filterableCols = React.useMemo(
    () => props.columns.filter((c) => c.type === "TEXT" || c.type === "NUMBER"),
    [props.columns],
  );

  const selectedView = React.useMemo(
    () => props.views.find((v) => v.id === props.viewId),
    [props.views, props.viewId],
  );

  const applyConfig = async () => {
    const viewId = props.viewId;
    if (!viewId) return;

    await updateConfigMut.mutateAsync({
      baseId: props.baseId,
      tableId: props.tableId,
      viewId,
      patch: draft,
    });

    await utils.view.get.invalidate({
      baseId: props.baseId,
      tableId: props.tableId,
      viewId,
    });

    props.onConfigSaved?.();
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    const name = trimmed.length > 0 ? trimmed : "New view";

    const created = await createMut.mutateAsync({
      baseId: props.baseId,
      tableId: props.tableId,
      name,
    });

    await utils.view.list.invalidate({ baseId: props.baseId, tableId: props.tableId });

    // Copy config from current view (nice UX)
    if (props.currentConfig) {
      await updateConfigMut.mutateAsync({
        baseId: props.baseId,
        tableId: props.tableId,
        viewId: created.id,
        patch: defaultConfig(props.currentConfig),
      });
    }

    props.onSelectView(created.id);
    props.onChangedView?.();
    setCreating(false);
    setNewName("");
    setPanelOpen(true);
  };

  const handleRename = async () => {
    const viewId = props.viewId;
    if (!viewId) return;

    const next = renameDraft.trim();
    if (next.length === 0) return;

    await renameMut.mutateAsync({
      baseId: props.baseId,
      tableId: props.tableId,
      viewId,
      name: next,
    });

    await utils.view.list.invalidate({ baseId: props.baseId, tableId: props.tableId });
    setRenaming(false);
  };

  const handleDelete = async () => {
    const viewId = props.viewId;
    if (!viewId) return;
    if (!canDelete) return;

    const ok = window.confirm("Delete this view? (You cannot delete the last view)");
    if (!ok) return;

    await deleteMut.mutateAsync({
      baseId: props.baseId,
      tableId: props.tableId,
      viewId,
    });

    await utils.view.list.invalidate({ baseId: props.baseId, tableId: props.tableId });

    const fallback = props.views.find((v) => v.id !== viewId)?.id;
    props.onSelectView(fallback);
    props.onChangedView?.();
    setPanelOpen(false);
  };

  // ---- Draft helpers ----
  const toggleHidden = (colId: string) => {
    setDraft((prev) => {
      const current = prev.hiddenColumnIds ?? EMPTY_STR_ARR;
      const s = new Set(current);
      if (s.has(colId)) s.delete(colId);
      else s.add(colId);
      return { ...prev, hiddenColumnIds: Array.from(s) };
    });
  };

  const clearSort = () => setDraft((prev) => ({ ...prev, sort: undefined }));

  const setSort = (columnId: string, direction: "asc" | "desc") =>
    setDraft((prev) => ({ ...prev, sort: { columnId, direction } }));

  const addFilter = () => {
    const first = filterableCols[0];
    if (!first) return;
    setDraft((prev) => ({ ...prev, filters: [...prev.filters, firstFilterForColumn(first)] }));
  };

  const removeFilter = (idx: number) => {
    setDraft((prev) => ({ ...prev, filters: prev.filters.filter((_, i) => i !== idx) }));
  };

  const updateFilterColumn = (idx: number, columnId: string) => {
    const col = props.columns.find((c) => c.id === columnId);
    if (!col) return;

    setDraft((prev) => {
      const next = [...prev.filters];
      next[idx] = firstFilterForColumn(col);
      return { ...prev, filters: next };
    });
  };

  const updateFilterOp = (idx: number, raw: string) => {
    setDraft((prev) => {
      const next = [...prev.filters];
      const f = next[idx];
      if (!f) return prev;

      if (f.kind === "text") {
        const op = parseTextOp(raw);
        const nf: TextFilter = { ...f, op };
        if (!needsValue(op)) delete nf.value;
        next[idx] = nf;
      } else {
        const op = parseNumOp(raw);
        const nf: NumberFilter = { ...f, op };
        if (!needsValue(op)) delete nf.value;
        next[idx] = nf;
      }

      return { ...prev, filters: next };
    });
  };

  const updateFilterValue = (idx: number, raw: string) => {
    setDraft((prev) => {
      const next = [...prev.filters];
      const f = next[idx];
      if (!f) return prev;

      if (f.kind === "text") {
        next[idx] = { ...f, value: raw };
      } else {
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
          next[idx] = { ...f, value: undefined };
        } else {
          const n = Number(trimmed);
          next[idx] = { ...f, value: Number.isFinite(n) ? n : undefined };
        }
      }

      return { ...prev, filters: next };
    });
  };

  // ---- UI ----
  return (
    <div className="relative flex items-center gap-2">
      <select
        className="rounded-md bg-white/10 px-3 py-2 outline-none"
        value={props.viewId ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          props.onSelectView(v === "" ? undefined : v); // ✅ no `||`
          props.onChangedView?.();
        }}
        disabled={props.viewsLoading || props.views.length === 0}
      >
        {props.views.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="rounded-md bg-white/10 px-3 py-2 text-white/80 hover:bg-white/15 disabled:opacity-50"
        onClick={() => setPanelOpen((s) => !s)}
        disabled={!props.viewId}
        title="View settings"
      >
        ⚙︎
      </button>

      {!creating ? (
        <button
          type="button"
          className="rounded-md bg-white/10 px-3 py-2 text-white/80 hover:bg-white/15"
          onClick={() => {
            setCreating(true);
            setNewName("");
          }}
        >
          + View
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            className="w-44 rounded-md bg-white/10 px-3 py-2 outline-none"
            placeholder="View name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
          />
          <button
            type="button"
            className="rounded-md bg-white/20 px-3 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
            disabled={createMut.isPending}
            onClick={() => void handleCreate()}
          >
            {createMut.isPending ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-2 text-white/70 hover:text-white"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <button
        type="button"
        className="rounded-md bg-white/10 px-3 py-2 text-white/80 hover:bg-white/15 disabled:opacity-50"
        disabled={!props.viewId || !canDelete || deleteMut.isPending}
        onClick={() => void handleDelete()}
        title={canDelete ? "Delete view" : "Cannot delete the last view"}
      >
        🗑
      </button>

      {panelOpen && props.viewId && (
        <div className="absolute left-0 right-0 top-[56px] z-10 rounded-xl border border-white/10 bg-[#0b0b0f] p-4 text-white shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-white/60">View</div>

              {!renaming ? (
                <div className="flex items-center gap-2">
                  <div className="truncate text-lg font-semibold">
                    {selectedView?.name ?? "—"}
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white/10 px-2 py-1 text-sm hover:bg-white/15"
                    onClick={() => {
                      setRenaming(true);
                      setRenameDraft(selectedView?.name ?? "");
                    }}
                  >
                    Rename
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    className="w-64 rounded-md bg-white/10 px-3 py-2 outline-none"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleRename();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-md bg-white/20 px-3 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
                    disabled={renameMut.isPending}
                    onClick={() => void handleRename()}
                  >
                    {renameMut.isPending ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-2 py-2 text-white/70 hover:text-white"
                    onClick={() => setRenaming(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/15"
              onClick={() => setPanelOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* SORT */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 font-semibold">Sort</div>

              <div className="flex items-center gap-2">
                <select
                  className="w-full rounded-md bg-white/10 px-3 py-2 outline-none"
                  value={draft.sort?.columnId ?? ""}
                  onChange={(e) => {
                    const colId = e.target.value;
                    if (colId.length === 0) clearSort();
                    else setSort(colId, draft.sort?.direction ?? "asc");
                  }}
                >
                  <option value="">(No sort)</option>
                  {filterableCols.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-md bg-white/10 px-3 py-2 outline-none"
                  value={draft.sort?.direction ?? "asc"}
                  onChange={(e) => {
                    const dir = parseSortDir(e.target.value);
                    const colId = draft.sort?.columnId;
                    if (colId) setSort(colId, dir);
                  }}
                  disabled={!draft.sort?.columnId}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </div>

            {/* HIDE COLUMNS */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 font-semibold">Hidden columns</div>

              <div className="max-h-44 overflow-auto rounded-md border border-white/10 p-2">
                {props.columns.map((c) => {
                  const checked = draft.hiddenColumnIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                      <input type="checkbox" checked={checked} onChange={() => toggleHidden(c.id)} />
                      <span className="truncate">
                        {c.name} <span className="text-white/50">({c.type})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* FILTERS */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 md:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="font-semibold">Filters</div>
                <button
                  type="button"
                  className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/15 disabled:opacity-50"
                  onClick={addFilter}
                  disabled={filterableCols.length === 0}
                >
                  + Filter
                </button>
              </div>

              {draft.filters.length === 0 ? (
                <div className="text-sm text-white/60">No filters.</div>
              ) : (
                <div className="space-y-2">
                  {draft.filters.map((f, idx) => {
                    const showValue = needsValue(f.op);
                    const valueStr =
                      f.kind === "number" ? String(f.value ?? "") : (f.value ?? "");

                    return (
                      <div
                        key={`${idx}-${f.columnId}-${f.op}`}
                        className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-black/20 p-2"
                      >
                        <select
                          className="min-w-[220px] rounded-md bg-white/10 px-3 py-2 outline-none"
                          value={f.columnId}
                          onChange={(e) => updateFilterColumn(idx, e.target.value)}
                        >
                          {filterableCols.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.type})
                            </option>
                          ))}
                        </select>

                        <select
                          className="min-w-[180px] rounded-md bg-white/10 px-3 py-2 outline-none"
                          value={f.op}
                          onChange={(e) => updateFilterOp(idx, e.target.value)}
                        >
                          {f.kind === "text" ? (
                            <>
                              <option value="is_empty">is empty</option>
                              <option value="is_not_empty">is not empty</option>
                              <option value="contains">contains</option>
                              <option value="not_contains">not contains</option>
                              <option value="equals">equals</option>
                            </>
                          ) : (
                            <>
                              <option value="is_empty">is empty</option>
                              <option value="is_not_empty">is not empty</option>
                              <option value="gt">&gt;</option>
                              <option value="lt">&lt;</option>
                              <option value="equals">=</option>
                            </>
                          )}
                        </select>

                        {showValue && (
                          <input
                            className="min-w-[220px] flex-1 rounded-md bg-white/10 px-3 py-2 outline-none"
                            placeholder={f.kind === "number" ? "Number…" : "Text…"}
                            value={valueStr}
                            onChange={(e) => updateFilterValue(idx, e.target.value)}
                            inputMode={f.kind === "number" ? "decimal" : "text"}
                          />
                        )}

                        <button
                          type="button"
                          className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/15"
                          onClick={() => removeFilter(idx)}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-white/60">
              {props.configLoading ? "Loading view…" : "Edits are applied when you click Apply."}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/15"
                onClick={() => setDraft(defaultConfig(props.currentConfig))}
              >
                Reset
              </button>

              <button
                type="button"
                className="rounded-md bg-white/20 px-4 py-2 font-semibold hover:bg-white/30 disabled:opacity-50"
                disabled={!props.viewId || updateConfigMut.isPending}
                onClick={() => void applyConfig()}
              >
                {updateConfigMut.isPending ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>

          {(updateConfigMut.error ?? createMut.error ?? renameMut.error ?? deleteMut.error) && (
            <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">
              {(updateConfigMut.error ?? createMut.error ?? renameMut.error ?? deleteMut.error)?.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
