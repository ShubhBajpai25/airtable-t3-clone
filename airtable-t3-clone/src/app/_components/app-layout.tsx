"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";

// Icons (replace with lucide-react later if you want)
const HomeIcon = () => <span className="text-lg">🏠</span>;
const TableIcon = () => <span className="text-lg">📋</span>;
const ChevronRight = () => <span className="text-xs">›</span>;
const ChevronDown = () => <span className="text-xs">‹</span>;
const SunIcon = () => <span className="text-lg">☀️</span>;
const MoonIcon = () => <span className="text-lg">🌙</span>;

type Base = { id: string; name: string };
type Table = { id: string; name: string };

type CurrentUser = {
  name: string;
  avatarUrl?: string; // optional (set later)
};

type SidebarProps = {
  bases?: Base[];
  tables?: Table[];
  currentBaseId?: string;
  currentTableId?: string;
  currentUser?: CurrentUser;
};

function getInitials(name?: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

function Sidebar({
  bases = [],
  tables = [],
  currentBaseId,
  currentTableId,
  currentUser,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [basesExpanded, setBasesExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const initials = useMemo(() => getInitials(currentUser?.name), [currentUser?.name]);

  return (
    <div
      className={[
        "flex h-screen flex-col border-r transition-all duration-200",
        collapsed ? "w-16" : "w-64",
        // Token-based colors (high contrast, auto theme)
        "bg-[var(--surface)] border-[var(--border-soft)]",
      ].join(" ")}
    >
      {/* Sidebar Header */}
      <div className="flex h-12 items-center justify-between border-b border-[var(--border-soft)] px-4">
        {!collapsed && (
          <Link href="/" className="text-lg font-bold">
            AirClone
          </Link>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight /> : <ChevronDown />}
        </button>
      </div>

      {/* Navigation */}
      <div className="scrollbar flex-1 overflow-y-auto p-2">
        {/* Home */}
        <Link
          href="/"
          className={[
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
              : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
          ].join(" ")}
        >
          <HomeIcon />
          {!collapsed && <span>Home</span>}
        </Link>

        {/* Bases Section */}
        {!collapsed && bases.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setBasesExpanded(!basesExpanded)}
              className="flex w-full items-center justify-between px-3 py-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
            >
              <span>WORKSPACES</span>
              <span>{basesExpanded ? "▼" : "▶"}</span>
            </button>

            {basesExpanded && (
              <div className="mt-1 space-y-1">
                {bases.map((base) => {
                  const isActive = currentBaseId === base.id;

                  return (
                    <div key={base.id}>
                      <Link
                        href={`/base/${base.id}`}
                        className={[
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-[var(--surface-2)] font-medium text-[var(--fg)]"
                            : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                        ].join(" ")}
                      >
                        <span className="truncate">{base.name}</span>
                      </Link>

                      {/* Tables for current base */}
                      {isActive && tables.length > 0 && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-[var(--border)] pl-3">
                          {tables.map((table) => (
                            <Link
                              key={table.id}
                              href={`/base/${base.id}/table/${table.id}`}
                              className={[
                                "flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                                currentTableId === table.id
                                  ? "bg-blue-100 font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                              ].join(" ")}
                            >
                              <TableIcon />
                              <span className="truncate">{table.name}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: Current user + icon-only theme toggle (replaces bottom-left Light/Dark Mode button) */}
      <div className="border-t border-[var(--border-soft)] p-2">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--surface-2)] transition-colors">
          {/* Avatar */}
          <div className="h-9 w-9 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center">
            {currentUser?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUser.avatarUrl}
                alt={`${currentUser.name} avatar`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold text-[var(--muted)]">{initials}</span>
            )}
          </div>

          {/* Name (hide when collapsed) */}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--fg)]">
                {currentUser?.name ?? "Guest"}
              </div>
              <div className="truncate text-xs text-[var(--muted)]">Signed in</div>
            </div>
          )}

          {/* Theme icon only */}
          <button
            onClick={toggleTheme}
            className="ml-auto rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

type AppLayoutProps = {
  children: React.ReactNode;
  bases?: Base[];
  tables?: Table[];
  currentBaseId?: string;
  currentTableId?: string;
  currentUser?: CurrentUser;
};

export function AppLayout({
  children,
  bases,
  tables,
  currentBaseId,
  currentTableId,
  currentUser,
}: AppLayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar
        bases={bases}
        tables={tables}
        currentBaseId={currentBaseId}
        currentTableId={currentTableId}
        currentUser={currentUser}
      />

      <main className="scrollbar relative flex-1 overflow-auto bg-[var(--bg)]">
        {children}

        {/* Floating Theme Toggle Button (optional - keep if you like) */}
        <button
          onClick={toggleTheme}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] shadow-lg transition-all hover:scale-110 hover:shadow-xl"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <span className="text-2xl">☀️</span> : <span className="text-2xl">🌙</span>}
        </button>
      </main>
    </div>
  );
}
