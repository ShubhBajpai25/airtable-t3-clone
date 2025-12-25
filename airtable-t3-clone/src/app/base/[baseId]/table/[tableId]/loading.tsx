function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] p-6 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 rounded-xl bg-white/10 p-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        {/* Grid container */}
        <div className="overflow-hidden rounded-xl bg-white/10">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
            <Skeleton className="col-span-3 h-6" />
            <Skeleton className="col-span-3 h-6" />
            <Skeleton className="col-span-2 h-6" />
            <Skeleton className="col-span-2 h-6" />
            <Skeleton className="col-span-2 h-6" />
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/10">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2">
                <Skeleton className="col-span-3 h-6" />
                <Skeleton className="col-span-3 h-6" />
                <Skeleton className="col-span-2 h-6" />
                <Skeleton className="col-span-2 h-6" />
                <Skeleton className="col-span-2 h-6" />
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-white/60">
          Loading table… (this will become the virtualized grid)
        </p>
      </div>
    </main>
  );
}
