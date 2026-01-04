"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";

// --- Icons ---
const LogoIcon = () => <span className="text-xl font-black">N</span>;
const TableIcon = () => <span className="text-lg">📋</span>;
const GridIcon = () => <span className="text-lg">▦</span>;
const ChevronDown = () => <span className="text-xs">▾</span>;
const ChevronRight = () => <span className="text-lg">›</span>;
const SunIcon = () => <span className="text-lg">☀️</span>;
const MoonIcon = () => <span className="text-lg">🌙</span>;

type Base = { id: string; name: string };
type Table = { id: string; name: string };
type View = { id: string; name: string; type: "GRID" | "GALLERY" };

type CurrentUser = {
  name: string;
  avatarUrl?: string;
};

type AppLayoutProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  bases?: Base[];
  tables?: Table[];
  views?: View[];
  currentBaseId?: string;
  currentTableId?: string;
  currentViewId?: string;
  currentUser?: CurrentUser;
  onCreateView?: (type: "GRID" | "GALLERY") => void;
};

function getInitials(name?: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

function LeftRail({ currentUser }: { currentUser?: CurrentUser }) {
  const { theme, toggleTheme } = useTheme();
  const [showCreateMenu, setShowCreateMenu] = React.useState(false);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const initials = useMemo(() => getInitials(currentUser?.name), [currentUser?.name]);

  return (
    <aside className="flex h-screen w-14 flex-col items-center border-r border-[var(--border-soft)] bg-[var(--surface)] py-3">
      {/* Logo */}
      <div className="mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <LogoIcon />
        </div>
      </div>

      {/* Create New Button */}
      <div className="relative mb-2">
        <button
          onClick={() => setShowCreateMenu(!showCreateMenu)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors"
          title="Create new"
        >
          <span className="text-2xl">+</span>
        </button>

        {/* Create Menu Dropdown */}
        {showCreateMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowCreateMenu(false)}
            />
            <div className="absolute left-full top-0 z-20 ml-2 w-56 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] shadow-lg">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
                Create New
              </div>
              <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors">
                <span>🗄️</span>
                <span>Base</span>
              </button>
              <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors">
                <TableIcon />
                <span>Table</span>
              </button>
              <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors rounded-b-lg">
                <GridIcon />
                <span>View</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="w-8 border-t border-[var(--border-soft)] mb-2" />

      {/* Theme Toggle Button */}
      <div className="mb-2">
        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <div className="flex-1" />

      {/* Profile at bottom */}
      <div className="relative mt-2 mb-1">
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)] shadow-sm hover:ring-2 hover:ring-blue-500/20 transition-all"
        >
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={`${currentUser.name} avatar`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs font-semibold text-[var(--muted)]">{initials}</span>
          )}
        </button>

        {/* Profile Menu */}
        {showProfileMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowProfileMenu(false)}
            />
            <div className="absolute bottom-full left-full z-20 mb-2 ml-2 w-64 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] shadow-lg">
              <div className="border-b border-[var(--border-soft)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center flex-shrink-0">
                    {currentUser?.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={`${currentUser.name} avatar`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-[var(--muted)]">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[var(--fg)]">
                      {currentUser?.name ?? "Guest"}
                    </div>
                    <div className="truncate text-xs text-[var(--muted)]">Signed in</div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  window.location.href = "/api/auth/signout";
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors rounded-b-lg"
              >
                <span>🚪</span>
                <span>Sign out</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function WorkspaceSidebar({
  bases = [],
  tables = [],
  views = [],
  currentBaseId,
  currentTableId,
  currentViewId,
  collapsed,
  onToggleCollapse,
  onCreateView,
}: {
  bases?: Base[];
  tables?: Table[];
  views?: View[];
  currentBaseId?: string;
  currentTableId?: string;
  currentViewId?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCreateView?: (type: "GRID" | "GALLERY") => void;
}) {
  const pathname = usePathname();
  const [showSearchModal, setShowSearchModal] = React.useState(false);
  const [showViewDropdown, setShowViewDropdown] = React.useState(false);

  const currentBaseName = bases.find((b) => b.id === currentBaseId)?.name ?? "Base";

  // Handle Esc key to close search modal
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSearchModal) {
        setShowSearchModal(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showSearchModal]);

  if (collapsed) {
    return (
      <aside className="flex h-screen w-12 flex-col items-center justify-center border-r border-[var(--border-soft)] bg-[var(--surface)] py-3">
        <button
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen min-h-0 w-80 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)]">
      {/* Header with Base selector and collapse */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-soft)]">
        <button
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
          title="Select base"
        >
          <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
            ⬢
          </span>
          <span className="truncate">{currentBaseName}</span>
          <ChevronDown />
        </button>

        <button
          onClick={onToggleCollapse}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors"
          title="Collapse sidebar"
        >
          <span className="text-lg">«</span>
        </button>
      </div>

      {/* Quick search - opens modal */}
      <div className="px-4 py-3">
        <button
          onClick={() => setShowSearchModal(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:border-blue-500 hover:ring-2 hover:ring-blue-500/20"
        >
          <span className="text-lg">🔎</span>
          <span className="text-sm text-[var(--muted)]">Quick search...</span>
          <span className="ml-auto rounded border border-[var(--border-soft)] px-1.5 py-0.5 text-xs text-[var(--muted)] font-mono">
            ⌘K
          </span>
        </button>
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSearchModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
            <div className="w-full max-w-2xl rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl">
              <div className="relative border-b border-[var(--border-soft)] px-4 py-3">
                <input
                  autoFocus
                  placeholder="Search bases, tables, views..."
                  className="w-full bg-transparent text-lg text-[var(--fg)] placeholder:text-[var(--muted)] outline-none pr-8"
                />
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto p-2">
                <div className="px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
                  Most Recently Viewed
                </div>
                {views.slice(0, 5).map((view) => (
                  <Link
                    key={view.id}
                    href={`/base/${currentBaseId}/table/${currentTableId}/view/${view.id}`}
                    onClick={() => setShowSearchModal(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <GridIcon />
                    <span>{view.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Navigation */}
      <div className="scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {/* Data Section */}
        <div className="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Data
        </div>

        <div className="mt-2 space-y-2">
          {tables.map((table) => {
            const tableActive = currentTableId === table.id;
            const tableHref = currentBaseId ? `/base/${currentBaseId}/table/${table.id}` : "#";
            const tableViews = tableActive ? views : [];

            return (
              <div key={table.id} className="space-y-0.5">
                <Link
                  href={tableHref}
                  className={[
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    tableActive && !currentViewId
                      ? "bg-[var(--surface-2)] text-[var(--fg)] font-medium"
                      : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                  ].join(" ")}
                >
                  <TableIcon />
                  <span className="truncate">{table.name}</span>
                </Link>

                {tableActive && (
                  <div className="ml-9 space-y-0.5">
                    {tableViews.map((view) => {
                      const viewHref = `/base/${currentBaseId}/table/${table.id}/view/${view.id}`;
                      const viewActive = currentViewId === view.id;

                      return (
                        <Link
                          key={view.id}
                          href={viewHref}
                          className={[
                            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                            viewActive
                              ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/20 dark:text-blue-200"
                              : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                          ].join(" ")}
                        >
                          <GridIcon />
                          <span className="truncate">{view.name}</span>
                        </Link>
                      );
                    })}

                    {/* Create View Button */}
                    <div className="relative">
                      <button
                        onClick={() => setShowViewDropdown(!showViewDropdown)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-900/20 transition-colors"
                        type="button"
                      >
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-blue-600 text-xs">
                          +
                        </span>
                        Create View
                      </button>

                      {showViewDropdown && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowViewDropdown(false)}
                          />
                          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] shadow-lg">
                            <button
                              onClick={() => {
                                onCreateView?.("GRID");
                                setShowViewDropdown(false);
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors rounded-t-lg"
                            >
                              <GridIcon />
                              <span>Grid</span>
                            </button>
                            <button
                              onClick={() => {
                                onCreateView?.("GALLERY");
                                setShowViewDropdown(false);
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors rounded-b-lg"
                              disabled
                            >
                              <span className="text-lg">🖼️</span>
                              <span>Gallery</span>
                              <span className="ml-auto text-xs text-[var(--muted)]">(Soon)</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Automations Section */}
        <div className="mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Automations
        </div>
        <div className="mt-2">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-900/20 transition-colors"
            type="button"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white text-xs">
              +
            </span>
            Create Automation
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AppLayout({
  children,
  header,
  bases,
  tables,
  views,
  currentBaseId,
  currentTableId,
  currentViewId,
  currentUser,
  onCreateView,
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[var(--bg)]">
      <LeftRail currentUser={currentUser} />

      <WorkspaceSidebar
        bases={bases}
        tables={tables}
        views={views}
        currentBaseId={currentBaseId}
        currentTableId={currentTableId}
        currentViewId={currentViewId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onCreateView={onCreateView}
      />

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
        <div className="scrollbar min-h-0 flex-1 overflow-auto bg-[var(--bg)]">
          {header && (
            <div className="sticky top-0 z-20 border-b border-[var(--border-soft)] bg-[var(--bg)]">
              {header}
            </div>
          )}

          {children}
        </div>
      </main>
    </div>
  );
}