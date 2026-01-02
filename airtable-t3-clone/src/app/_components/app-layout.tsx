"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";

// --- Icons (swap to lucide-react later) ---
const LogoIcon = () => <span className="text-xl font-black">N</span>;
const HomeIcon = () => <span className="text-lg">🏠</span>;
const SearchIcon = () => <span className="text-lg">🔎</span>;
const ClockIcon = () => <span className="text-lg">🕒</span>;
const SettingsIcon = () => <span className="text-lg">⚙️</span>;
const TableIcon = () => <span className="text-lg">📋</span>;
const ChevronDown = () => <span className="text-xs">▾</span>;
const SunIcon = () => <span className="text-lg">☀️</span>;
const MoonIcon = () => <span className="text-lg">🌙</span>;

type Base = { id: string; name: string };
type Table = { id: string; name: string };

type CurrentUser = {
  name: string;
  avatarUrl?: string;
};

type AppLayoutProps = {
  children: React.ReactNode;
  header?: React.ReactNode; // optional top content (tabs/header)
  bases?: Base[];
  tables?: Table[];
  currentBaseId?: string;
  currentTableId?: string;
  currentUser?: CurrentUser;
  dataSourcesCount?: number; // optional badge for tabs etc (if you want)
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

function LeftRail({
  currentUser,
}: {
  currentUser?: CurrentUser;
}) {
  const pathname = usePathname();
  const initials = useMemo(() => getInitials(currentUser?.name), [currentUser?.name]);

  return (
    <aside className="flex h-screen w-14 flex-col items-center border-r border-[var(--border-soft)] bg-[var(--surface)] py-2">
      <div className="mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
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

      {/* bottom avatar only (like screenshot) */}
      <div className="mt-2 mb-1">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)]">
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
      </div>
    </aside>
  );
}

function WorkspaceSidebar({
  bases = [],
  tables = [],
  currentBaseId,
  currentTableId,
  currentUser,
}: {
  bases?: Base[];
  tables?: Table[];
  currentBaseId?: string;
  currentTableId?: string;
  currentUser?: CurrentUser;
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const currentBaseName =
    bases.find((b) => b.id === currentBaseId)?.name ?? "Base";

  const initials = useMemo(() => getInitials(currentUser?.name), [currentUser?.name]);

  const overviewHref = currentBaseId ? `/base/${currentBaseId}` : "/";
  const isOverviewActive = currentBaseId ? pathname === `/base/${currentBaseId}` : pathname === "/";

  return (
    <aside className="flex h-screen w-80 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)]">
      {/* Base selector row */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--surface-2)]"
          title="Select base"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
            ⬢
          </span>
          <span className="truncate">{currentBaseName}</span>
          <ChevronDown />
        </button>

        {/* (optional) collapse icon could go here later */}
      </div>

      {/* Quick search */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2">
          <SearchIcon />
          <input
            placeholder="Quick search..."
            className="w-full bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--muted)] outline-none"
          />
          <span className="rounded border border-[var(--border-soft)] px-1.5 py-0.5 text-xs text-[var(--muted)]">
            ⌘ K
          </span>
        </div>
      </div>

      {/* Create New */}
      <div className="px-4 pb-2">
        <button
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-900/20"
          type="button"
        >
          <span className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white">
              +
            </span>
            Create New
          </span>
          <ChevronDown />
        </button>
      </div>

      {/* Nav */}
      <div className="scrollbar flex-1 overflow-y-auto px-2 pb-2">
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

        {/* Data */}
        <div className="mt-4 px-3 text-xs font-semibold text-[var(--muted)]">
          Data
        </div>

        <div className="mt-1 space-y-1 px-1">
          {tables.map((table) => {
            const href =
              currentBaseId ? `/base/${currentBaseId}/table/${table.id}` : "#";
            const active = currentTableId === table.id;

            return (
              <Link
                key={table.id}
                href={href}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[var(--surface-2)] text-[var(--fg)] font-medium"
                    : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                ].join(" ")}
              >
                <TableIcon />
                <span className="truncate">{table.name}</span>
              </Link>
            );
          })}

          <button
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
            type="button"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-[var(--border-soft)]">
              +
            </span>
            Create View
          </button>
        </div>

        {/* Automations */}
        <div className="mt-6 px-3 text-xs font-semibold text-[var(--muted)]">
          Automations
        </div>
        <div className="mt-1 px-1">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-900/20"
            type="button"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white">
              +
            </span>
            Create Automation
          </button>
        </div>
      </div>

      {/* Footer: user + theme icon only */}
      <div className="border-t border-[var(--border-soft)] p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--surface-2)]">
          {/* avatar */}
          <div className="h-9 w-9 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center">
            {currentUser?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUser.avatarUrl}
                alt={`${currentUser.name} avatar`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold text-[var(--muted)]">
                {initials}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[var(--fg)]">
              {currentUser?.name ?? "Guest"}
            </div>
            <div className="truncate text-xs text-[var(--muted)]">Signed in</div>
          </div>

          {/* theme icon only */}
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
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
  currentBaseId,
  currentTableId,
  currentUser,
}: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <LeftRail currentUser={currentUser} />
      <WorkspaceSidebar
        bases={bases}
        tables={tables}
        currentBaseId={currentBaseId}
        currentTableId={currentTableId}
        currentUser={currentUser}
      />

      <main className="scrollbar relative flex-1 overflow-auto bg-[var(--bg)]">
        {header ? (
          <div className="sticky top-0 z-20 border-b border-[var(--border-soft)] bg-[var(--bg)]">
            {header}
          </div>
        ) : null}

        {children}
      </main>
    </div>
  );
}
