"use client";

import * as React from "react";
import { api } from "~/trpc/react";

type Col = { id: string; name: string; type: "TEXT" | "NUMBER"; order: number };

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

type ViewSort = {
  columnId: string;
  direction: "asc" | "desc";
};

export type ViewConfig = {
  filters: ViewFilter[];
  sort?: ViewSort;
  q?: string;
  hiddenColumnIds: string[];
  // passthrough allows extra keys
  [k: string]: unknown;
};

function defaultConfig(config?: Partial<ViewConfig>): ViewConfig {
  return {
    filters: config?.filters ?? [],
    sort: config?.sort,
    q: config?.q,
    hiddenColumnIds: config?.hiddenColumnIds ?? [],
  };
}

function needsValue(filter: ViewFilter) {
  if (filter.op === "is_empty" || filter.op === "is_not_empty") return false;
  return true;
}

function firstFilterForColumn(col: Col): ViewFilter {
  if (col.type === "NUMBER") {
    return { kind: "number", columnId: col.id, op: "gt", value: 0 };
  }
  return { kind: "text", columnId: col.id, op: "contains", value: "" };
}

export function ViewControls(props: {
  baseId: string;
  tableId: string;

  // controlled selection from TableGrid
  viewId?: string;
  onSelectView: (next?: string) => void;

  // data passed from TableGrid
  views: Array<{ id: string; name: string }>;
  viewsLoading: boolean;

  currentConfig?: ViewConfig;
  configLoading: boolean;

  columns: Col[];

  // TableGrid can pass a callback to clear selection/scroll etc
  onChangedView?: () => void;

  // optional: invalidate rowsInfinite after config changes
  onConfigSaved?: () => void;
}) {
  const utils = api.useUtils();

  const [showPanel, setShowPanel] = React.useState(false);

  // create UI
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");

  // rename UI
  const [renaming, setRenaming] = React.useState(false);
  const [renameDraft, setRenameDraft] = React.useState("");

  // local draft config (apply button)
  const [draft, setDraft] = React.useState<ViewConfig>(() => defaultConfig(props.currentConfig));

  React.useEffect(() => {
    // when switching views / config loads, reset draft
    setDraft(defaultConfig(props.currentConfig));
    setRenaming(false);
    setCreating(false);
    setNewName("");
    setRenameDraft("");
  }, [props.viewId, props.currentConfig]);

  const createMut = api.view.create.useMutation();
  const renameMut = api.view.rename.useMutation();
  const deleteMut = api.view.delete.useMutation();
  const updateConfigMut = api.view.updateConfig.useMutation();

  const canDelete = (props.views?.length ?? 0) > 1;

  const allFilterableCols = React.useMemo(
    () => props.columns.filter((c) => c.type === "TEXT" || c.type === "NUMBER"),
    [props.columns],
  );

  const applyConfig = async () => {
    if (!props.viewId) return;

    await updateConfigMut.mutateAsync({
      baseId: props.baseId,
      tableId: props.tableId,
      viewId: props.viewId,
      patch: draft,
    });

    await utils.view.get.invalidate({
      baseId: props.baseId,
      tableId: props.tableId,
      viewId: props.viewId,
    });

    props.onConfigSaved?.();
  };

  const handleCreate = async () => {
    const name = newName.trim() || "New view";

    const created = await createMut.mutateAsync({
      baseId: props.baseId,
      tableId: props.tableId,
      name,
    });

    await utils.view.list.invalidate({ baseId: props.baseId, tableId: props.tableId });

    // optionally copy current config into the new view (so views feel meaningful immediately)
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
    setShowPanel(true);
  };

  const handleRename = async () => {
    if (!props.viewId) return;
    const next = renameDraft.trim();
    if (!next) return;

    await renameMut.mutateAsync({
      baseId: props.baseId,
      tableId: props.tableId,
      viewId: props.viewId,
      name: next,
    });

    await utils.view.list.invalidate({ baseId: props.baseId, tableId: props.tableId });
    setRenaming(false);
  };

  const handleDelete = async () => {
    if (!props.viewId) return;
    if (!canDelete) return;

    const ok = window.confirm("Delete this view? (You cannot delete the last view)");
    if (!ok) return;

    const toDelete = props.viewId;

    await deleteMut.mutateAsync({
      baseId: props.baseId,
      tableId: props.tableId,
      viewId: toDelete,
    });

    await utils.view.list.invalidate({ baseId: props.baseId, tableId: props.tableId });

    // choose next view locally
    const fallback = props.views.find((v) => v.id !== toDelete)?.id;
    props.onSelectView(fallback);
    props.onChangedView?.();
  };

  // ------- Draft config helpers -------
  const toggleHidden = (colId: string) => {
    setDraft((prev) => {
      const s = new Set(prev.hiddenColumnIds);
      if (s.has(colId)) s.delete(colId);
      else s.add(colId);
      return { ...prev, hiddenColumnIds: Array.from(s) };
    });
  };

  const setSort = (columnId: string, direction: "asc" | "desc") => {
    setDraft((prev) => ({ ...prev, sort: columnId ? { columnId, direction } : undefined }));
  };

  const clearSort = () => setDraft((prev) => ({ ...prev, sort: undefined }));

  const addFilter = () => {
    const first = allFilterableCols[0];
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

  const updateFilterOp = (idx: number, op: string) => {
    setDraft((prev) => {
      const next = [...prev.filters];
      const f = next[idx];
      if (!f) return prev;

      if (f.kind === "text") {
        const nf: TextFilter = { ...f, op: op as TextOp };
        if (!needsValue(nf)) delete nf.value;
        next[idx] = nf;
      } else {
        const nf: NumberFilter = { ...f, op: op as NumOp };
        if (!needsValue(nf)) delete nf.value;
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
        const nf: TextFilter = { ...f, value: raw };
        next[idx] = nf;
      } else {
        const trimmed = raw.trim();
        const num = trimmed === "" ? undefined : Number(trimmed);
        const nf: NumberFilter = { ...f, value: Number.isFinite(num as number) ? (num as number) : undefined };
        next[idx] = nf;
      }

      return { ...prev, filters: next };
    });
  };

  // ------- UI -------
  const selectedView = props.views.find((v) => v.id === props.viewId);

  return (
    <div className="flex items-center gap-2">
      <select
        className="rounded-md bg-white/10 px-3 py-2 outline-none"
        value={props.viewId ?? ""}
        onChange={(e) => {
          props.onSelectView(e.target.value || undefined);
          props.onChangedView?.();
        }}
        disabled={props.viewsLoading || !props.views?.length}
      >
        {(props.views ?? []).map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="rounded-md bg-white/10 px-3 py-2 text-white/80 hover:bg-white/15"
        onClick={() => setShowPanel((s) => !s)}
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

      {showPanel && props.viewId && (
        <div className="absolute left-0 right-0 top-[64px] z-10 mx-3 rounded-xl border border-white/10 bg-[#0b0b0f] p-4 text-white shadow-xl">
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
              onClick={() => setShowPanel(false)}
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
                    if (!colId) clearSort();
                    else setSort(colId, draft.sort?.direction ?? "asc");
                  }}
                >
                  <option value="">(No sort)</option>
                  {allFilterableCols.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-md bg-white/10 px-3 py-2 outline-none"
                  value={draft.sort?.direction ?? "asc"}
                  onChange={(e) => {
                    const dir = e.target.value as "asc" | "desc";
                    const colId = draft.sort?.columnId ?? "";
                    if (colId) setSort(colId, dir);
                  }}
                  disabled={!draft.sort?.columnId}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>

              <div className="mt-2 text-sm text-white/60">
                Sorting changes which rows you see first and activates the keyset cursor path.
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
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleHidden(c.id)}
                      />
                      <span className="truncate">
                        {c.name} <span className="text-white/50">({c.type})</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-2 text-sm text-white/60">
                Hidden columns won’t render in the grid for this view.
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
                  disabled={allFilterableCols.length === 0}
                >
                  + Filter
                </button>
              </div>

              {draft.filters.length === 0 ? (
                <div className="text-sm text-white/60">No filters.</div>
              ) : (
                <div className="space-y-2">
                  {draft.filters.map((f, idx) => {
                    const col = props.columns.find((c) => c.id === f.columnId);
                    const kind = f.kind;

                    const ops: Array<{ value: string; label: string }> =
                      kind === "text"
                        ? [
                            { value: "is_empty", label: "is empty" },
                            { value: "is_not_empty", label: "is not empty" },
                            { value: "contains", label: "contains" },
                            { value: "not_contains", label: "not contains" },
                            { value: "equals", label: "equals" },
                          ]
                        : [
                            { value: "is_empty", label: "is empty" },
                            { value: "is_not_empty", label: "is not empty" },
                            { value: "gt", label: ">" },
                            { value: "lt", label: "<" },
                            { value: "equals", label: "=" },
                          ];

                    const showValue = needsValue(f);

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
                          {allFilterableCols.map((c) => (
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
                          {ops.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>

                        {showValue && (
                          <input
                            className="min-w-[220px] flex-1 rounded-md bg-white/10 px-3 py-2 outline-none"
                            placeholder={kind === "number" ? "Number…" : "Text…"}
                            value={
                              kind === "number"
                                ? String((f as NumberFilter).value ?? "")
                                : String((f as TextFilter).value ?? "")
                            }
                            onChange={(e) => updateFilterValue(idx, e.target.value)}
                            inputMode={kind === "number" ? "decimal" : "text"}
                          />
                        )}

                        <button
                          type="button"
                          className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/15"
                          onClick={() => removeFilter(idx)}
                        >
                          Remove
                        </button>

                        <div className="text-xs text-white/50">
                          {col ? `Column type: ${col.type}` : "Column missing"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* footer */}
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

          {(updateConfigMut.error || createMut.error || renameMut.error || deleteMut.error) && (
            <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">
              {(updateConfigMut.error ?? createMut.error ?? renameMut.error ?? deleteMut.error)?.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
