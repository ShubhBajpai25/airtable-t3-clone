"use client";

import { useTheme } from './theme-provider';
import { useEffect, useState } from 'react';

export function ThemeDebug() {
  const { theme, toggleTheme } = useTheme();
  const [htmlClasses, setHtmlClasses] = useState('');

  useEffect(() => {
    // Update HTML classes display
    const updateClasses = () => {
      setHtmlClasses(document.documentElement.className);
    };
    
    updateClasses();
    
    // Watch for class changes
    const observer = new MutationObserver(updateClasses);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 rounded-lg border-2 border-red-500 bg-white p-4 shadow-lg dark:bg-gray-800">
      <h3 className="font-bold text-red-600 dark:text-red-400">Theme Debug</h3>
      <div className="mt-2 space-y-1 text-sm">
        <div>
          <strong>Current theme:</strong> <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">{theme}</code>
        </div>
        <div>
          <strong>HTML classes:</strong> <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">{htmlClasses || '(none)'}</code>
        </div>
        <div>
          <strong>Dark class present:</strong> {document.documentElement.classList.contains('dark') ? '✅ YES' : '❌ NO'}
        </div>
      </div>
      <button
        onClick={toggleTheme}
        className="mt-3 w-full rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
      >
        Toggle Theme (Test)
      </button>
      <div className="mt-2 rounded bg-gray-100 p-2 text-xs dark:bg-gray-700">
        <div>This box should change color ↑</div>
        <div className="text-gray-600 dark:text-gray-400">Gray text should change too</div>
      </div>
    </div>
  );
}