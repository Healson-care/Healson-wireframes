import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-md", className)} />;
}

export function ClientLayoutSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Skeleton className="h-6 w-32" />
          <div className="hidden sm:flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-16" />
            ))}
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <div className="flex-1 mx-auto w-full max-w-2xl px-4 py-6 flex flex-col gap-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Skeleton className="h-6 w-32" />
          <div className="hidden lg:flex gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-14" />
            ))}
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SidebarDashboardSkeleton() {
  return (
    <div className="min-h-screen flex" dir="rtl">
      <div className="hidden lg:flex flex-col w-64 shrink-0 border-l border-slate-200 bg-white p-3 gap-4">
        <Skeleton className="h-8 w-32 mx-2" />
        {Array.from({ length: 4 }).map((_, g) => (
          <div key={g} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16 mx-2" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white h-[57px]" />
        <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}
