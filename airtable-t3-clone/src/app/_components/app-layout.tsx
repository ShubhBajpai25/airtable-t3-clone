"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './theme-provider';

// Icons (using simple text/emoji for now - you can replace with lucide-react)
const HomeIcon = () => <span className="text-lg">🏠</span>;
const TableIcon = () => <span className="text-lg">📋</span>;
const ChevronRight = () => <span className="text-xs">›</span>;
const ChevronDown = () => <span className="text-xs">‹</span>;
const SunIcon = () => <span className="text-lg">☀️</span>;
const MoonIcon = () => <span className="text-lg">🌙</span>;

type Base = {
  id: string;
  name: string;
};

type Table = {
  id: string;
  name: string;
};

type SidebarProps = {
  bases?: Base[];
  tables?: Table[];
  currentBaseId?: string;
  currentTableId?: string;
};

function Sidebar({ bases = [], tables = [], currentBaseId, currentTableId }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [basesExpanded, setBasesExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  return (
    <div
      className={`
        flex h-screen flex-col border-r transition-all duration-200
        ${collapsed ? 'w-16' : 'w-64'}
        bg-gray-50 border-gray-200
        dark:bg-gray-900 dark:border-gray-800
      `}
    >
      {/* Sidebar Header */}
      <div className="flex h-12 items-center justify-between border-b px-4 border-gray-200 dark:border-gray-800">
        {!collapsed && (
          <Link href="/" className="text-lg font-bold text-gray-900 dark:text-white">
            AirClone
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight /> : <ChevronDown />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Home */}
        <Link
          href="/"
          className={`
            flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
            ${pathname === '/' 
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800'
            }
          `}
        >
          <HomeIcon />
          {!collapsed && <span>Home</span>}
        </Link>

        {/* Bases Section */}
        {!collapsed && bases.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setBasesExpanded(!basesExpanded)}
              className="flex w-full items-center justify-between px-3 py-1 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <span>WORKSPACES</span>
              <span>{basesExpanded ? '▼' : '▶'}</span>
            </button>

            {basesExpanded && (
              <div className="mt-1 space-y-1">
                {bases.map((base) => {
                  const isActive = currentBaseId === base.id;
                  return (
                    <div key={base.id}>
                      <Link
                        href={`/base/${base.id}`}
                        className={`
                          flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors
                          ${isActive
                            ? 'bg-gray-200 font-medium text-gray-900 dark:bg-gray-800 dark:text-white'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800/50'
                          }
                        `}
                      >
                        <span className="truncate">{base.name}</span>
                      </Link>

                      {/* Tables for current base */}
                      {isActive && tables.length > 0 && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-gray-300 dark:border-gray-700 pl-3">
                          {tables.map((table) => (
                            <Link
                              key={table.id}
                              href={`/base/${base.id}/table/${table.id}`}
                              className={`
                                flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors
                                ${currentTableId === table.id
                                  ? 'bg-blue-100 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800/50'
                                }
                              `}
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

      {/* Theme Toggle */}
      <div className="border-t p-2 border-gray-200 dark:border-gray-800">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          {!collapsed && <span>{theme === 'dark' ? 'Light' : 'Dark'} Mode</span>}
        </button>
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
};

export function AppLayout({ 
  children, 
  bases, 
  tables, 
  currentBaseId, 
  currentTableId 
}: AppLayoutProps) {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      <Sidebar
        bases={bases}
        tables={tables}
        currentBaseId={currentBaseId}
        currentTableId={currentTableId}
      />
      <main className="relative flex-1 overflow-auto">
        {children}
        
        {/* Floating Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-300 bg-white shadow-lg transition-all hover:scale-110 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <span className="text-2xl">☀️</span>
          ) : (
            <span className="text-2xl">🌙</span>
          )}
        </button>
      </main>
    </div>
  );
}