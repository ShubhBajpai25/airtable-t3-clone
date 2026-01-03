"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";

// --- Icons ---
const LogoIcon = () => <span className="text-xl font-black">N</span>;
const HomeIcon = () => <span className="text-lg">🏠</span>;
const SearchIcon = () => <span className="text-lg">🔎</span>;
const ClockIcon = () => <span className="text-lg">🕒</span>;
const SettingsIcon = () => <span className="text-lg">⚙️</span>;
const TableIcon = () => <span className="text-lg">📋</span>;
const GridIcon = () => <span className="text-lg">▦</span>;
const ChevronDown = () => <span className="text-xs">▾</span>;
const SunIcon = () => <span className="text-lg">☀️</span>;
const MoonIcon = () => <span className="text-lg">🌙</span>;
const CollapseIcon = () => <span className="text-lg">«</span>;

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

function IconButton({
  title,
  children,
  onClick,
  href,
  active,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const base =
    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors";
  const cls = active
    ? `${base} bg-[var(--surface-2)] text-[var(--fg)]`
    : `${base} text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]`;

  if (href) {
    return (
      <Link href={href} className={cls} title={title} aria-label={title}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls} title={title} aria-label={title}>
      {children}
    </button>
  );
}

function LeftRail({ currentUser }: { currentUser?: CurrentUser }) {
  const pathname = usePathname();
  const initials = useMemo(() => getInitials(currentUser?.name), [currentUser?.name]);

  return (
    <aside className="flex h-screen w-14 flex-col items-center border-r border-[var(--border-soft)] bg-[var(--surface)] py-3">
      <div className="mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <LogoIcon />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <IconButton title="Home" href="/" active={pathname === "/"}>
          <HomeIcon />
        </IconButton>
        <IconButton title="Search" href="/search" active={pathname.startsWith("/search")}>
          <SearchIcon />
        </IconButton>
        <IconButton title="Recent" href="/recent" active={pathname.startsWith("/recent")}>
          <ClockIcon />
        </IconButton>
        <IconButton title="Settings" href="/settings" active={pathname.startsWith("/settings")}>
          <SettingsIcon />
        </IconButton>
      </div>

      <div className="mt-2 mb-1">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)] shadow-sm">
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
  currentUser,
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
  currentUser?: CurrentUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCreateView?: (type: "GRID" | "GALLERY") => void;
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [showViewDropdown, setShowViewDropdown] = React.useState(false);

  const currentBaseName = bases.find((b) => b.id === currentBaseId)?.name ?? "Base";
  const initials = useMemo(() => getInitials(currentUser?.name), [currentUser?.name]);

  const overviewHref = currentBaseId ? `/base/${currentBaseId}` : "/";
  const isOverviewActive = currentBaseId ? pathname === `/base/${currentBaseId}` : pathname === "/";

  if (collapsed) {
    return (
      <aside className="flex h-screen w-12 flex-col items-center border-r border-[var(--border-soft)] bg-[var(--surface)] py-3">
        <button
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          title="Expand sidebar"
        >
          <span className="rotate-180 text-lg">«</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-80 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)]">
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
          <CollapseIcon />
        </button>
      </div>

      {/* Quick search */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
          <SearchIcon />
          <input
            placeholder="Quick search..."
            className="w-full bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--muted)] outline-none"
          />
          <span className="rounded border border-[var(--border-soft)] px-1.5 py-0.5 text-xs text-[var(--muted)] font-mono">
            ⌘K
          </span>
        </div>
      </div>

      {/* Create New */}
      <div className="px-4 pb-3">
        <button
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-900/20 transition-colors"
          type="button"
        >
          <span className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white text-xs">
              +
            </span>
            Create New
          </span>
          <ChevronDown />
        </button>
      </div>

      {/* Navigation */}
      <div className="scrollbar flex-1 overflow-y-auto px-3 pb-3">
        <Link
          href={overviewHref}
          className={[
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isOverviewActive
              ? "bg-[var(--surface-2)] text-[var(--fg)]"
              : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
          ].join(" ")}
        >
          <HomeIcon />
          <span>Overview</span>
        </Link>

        {/* Data Section */}
        <div className="mt-5 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Data
        </div>

        <div className="mt-2 space-y-2">
          {tables.map((table) => {
            const tableActive = currentTableId === table.id;
            const tableHref = currentBaseId ? `/base/${currentBaseId}/table/${table.id}` : "#";
            
            // Filter views for this table
            const tableViews = views.filter(v => v.id.startsWith(table.id));

            return (
              <div key={table.id} className="space-y-0.5">
                {/* Table Name */}
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

                {/* Views under this table */}
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

                      {/* Dropdown */}
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

      {/* Footer */}
      <div className="border-t border-[var(--border-soft)] p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--surface-2)] transition-colors">
          <div className="h-9 w-9 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center flex-shrink-0">
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

          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors flex-shrink-0"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
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
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <LeftRail currentUser={currentUser} />
      <WorkspaceSidebar
        bases={bases}
        tables={tables}
        views={views}
        currentBaseId={currentBaseId}
        currentTableId={currentTableId}
        currentViewId={currentViewId}
        currentUser={currentUser}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onCreateView={onCreateView}
      />

      <main className="scrollbar relative flex-1 overflow-auto bg-[var(--bg)]">
        {header && (
          <div className="sticky top-0 z-20 border-b border-[var(--border-soft)] bg-[var(--bg)]">
            {header}
          </div>
        )}

        {children}
      </main>
    </div>
  );
}