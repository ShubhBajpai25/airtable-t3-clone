function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] p-8 text-white">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-10 w-44" />

        <div className="rounded-xl bg-white/10 p-4">
          <Skeleton className="mb-4 h-7 w-56" />
          <div className="mb-4 flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-28" />
          </div>

          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
