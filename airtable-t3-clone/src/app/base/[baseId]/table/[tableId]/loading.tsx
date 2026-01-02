export default function TableGridLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Header with controls - visible but disabled looking */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4 opacity-50">
            <div className="text-gray-600 dark:text-gray-400">
              Rows (DB): <span className="font-semibold text-gray-900 dark:text-white">—</span>
              <span className="mx-2 text-gray-300 dark:text-gray-700">•</span>
              Loaded: <span className="font-semibold text-gray-900 dark:text-white">—</span>
            </div>

            <div className="flex items-center gap-2">
              <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" disabled>
                <option>Loading...</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className="cursor-not-allowed rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" disabled>
                + Column
              </button>
              <button className="cursor-not-allowed rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" disabled>
                Add 100k rows
              </button>
              <button className="cursor-not-allowed rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" disabled>
                Delete column
              </button>
              <input
                className="w-64 cursor-not-allowed rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="Search all cells…"
                disabled
              />
              <button className="cursor-not-allowed rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white" disabled>
                Search
              </button>
            </div>
          </div>

          {/* Blank loading area */}
          <div className="relative flex h-[70vh] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
            {/* Animated loading indicator */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                <div className="h-3 w-3 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]"></div>
                <div className="h-3 w-3 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]"></div>
                <div className="h-3 w-3 animate-bounce rounded-full bg-blue-600"></div>
              </div>
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                Loading table data...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}