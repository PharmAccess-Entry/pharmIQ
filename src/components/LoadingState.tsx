import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Branded full-screen / section loader ────────────────────────────────────

type BrandedLoaderProps = {
  /** true = takes up the full viewport; false = fills its container */
  fullscreen?: boolean;
  message?: string;
  className?: string;
};

export const BrandedLoader = ({
  fullscreen = true,
  message = "Loading…",
  className,
}: BrandedLoaderProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-5",
      fullscreen ? "fixed inset-0 z-50 bg-background" : "w-full py-20",
      className
    )}
  >
    {/* Pulsing icon mark */}
    <div className="relative">
      <span className="absolute inset-0 rounded-2xl bg-primary opacity-20 animate-ping" />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-hero shadow-glow">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 text-primary-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Pharmacy cross / plus icon */}
          <path d="M12 5v14" />
          <path d="M5 12h14" />
          <rect x="3" y="3" width="18" height="18" rx="4" />
        </svg>
      </span>
    </div>

    {/* Wordmark */}
    <p
      className="text-xl font-extrabold tracking-tight text-foreground"
      style={{ fontFamily: "'Sora', 'Inter', sans-serif" }}
    >
      Pharm<span className="text-primary">IQ</span>
    </p>

    {/* Optional message */}
    {message && (
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    )}
  </div>
);

// ─── Stat-card skeleton (Dashboard grid) ─────────────────────────────────────

export const StatCardSkeleton = () => (
  <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft space-y-3">
    <Skeleton className="h-9 w-9 rounded-lg" />
    <Skeleton className="h-7 w-24 rounded-md" />
    <Skeleton className="h-4 w-20 rounded-md" />
  </div>
);

// ─── Chart skeleton ───────────────────────────────────────────────────────────

export const ChartSkeleton = () => (
  <div className="bg-card border border-border rounded-2xl shadow-soft p-4 sm:p-5 mb-10">
    <div className="flex items-center justify-between mb-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-36 rounded-md" />
        <Skeleton className="h-3.5 w-28 rounded-md" />
      </div>
      <Skeleton className="h-8 w-48 rounded-full" />
    </div>
    <Skeleton className="h-56 sm:h-64 w-full rounded-xl" />
  </div>
);

// ─── Order-row skeleton ───────────────────────────────────────────────────────

export const OrderRowSkeleton = () => (
  <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border last:border-0">
    <div className="flex items-center gap-3 min-w-0">
      <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
      <div className="space-y-1.5 min-w-0">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-5 w-14 rounded-md" />
    </div>
  </div>
);

// ─── Event-card skeleton ──────────────────────────────────────────────────────

export const EventCardSkeleton = () => (
  <div className="bg-card border border-border rounded-2xl p-5 shadow-soft space-y-3">
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1.5 min-w-0">
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="h-3.5 w-24 rounded-md" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full shrink-0" />
    </div>
    <div className="space-y-1.5 mt-2">
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-3/4 rounded-md" />
    </div>
    <Skeleton className="h-10 w-full rounded-xl mt-2" />
  </div>
);

// ─── Menu item card skeleton ──────────────────────────────────────────────────

export const MenuCardSkeleton = () => (
  <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-soft">
    <Skeleton className="aspect-video w-full" />
    <div className="p-3 space-y-2">
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3.5 w-full rounded-md" />
      <Skeleton className="h-3.5 w-1/2 rounded-md" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  </div>
);

// ─── Menu category bubble skeleton ───────────────────────────────────────────

export const CategoryBubbleSkeleton = () => (
  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
    {Array.from({ length: 6 }).map((_, i) => (
      <Skeleton key={i} className="h-9 w-20 rounded-full shrink-0" />
    ))}
  </div>
);

// ─── Menu header skeleton (Pharmacy Name + logo) ────────────────────────────

export const MenuHeaderSkeleton = () => (
  <div className="flex items-center gap-3 p-4">
    <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
    <div className="space-y-1.5 min-w-0">
      <Skeleton className="h-5 w-40 rounded-md" />
      <Skeleton className="h-3.5 w-28 rounded-md" />
    </div>
  </div>
);

// ─── Order Detail skeleton (Dashboard) ───────────────────────────────────────

export const OrderDetailSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-4 w-32 rounded-md mb-4" />
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-4 w-64 rounded-md" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
          <div className="space-y-4 pt-4 border-t border-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-6 border-t border-border">
            <Skeleton className="h-4 w-12 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
           <Skeleton className="h-6 w-40 rounded-md" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
           <Skeleton className="h-6 w-32 rounded-md" />
           <Skeleton className="h-12 w-full rounded-xl" />
           <Skeleton className="h-10 w-full rounded-xl opacity-50" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
           <Skeleton className="h-4 w-24 rounded-md" />
           <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

// ─── Notification-row skeleton ────────────────────────────────────────────────
export const NotificationRowSkeleton = () => (
  <div className="flex items-start gap-4 p-4 border-b border-border last:border-0">
    <Skeleton className="h-2 w-2 rounded-full mt-2 shrink-0 bg-muted/40" />
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-4 w-1/4 rounded-md" />
      <Skeleton className="h-3.5 w-2/3 rounded-md" />
      <Skeleton className="h-3 w-16 rounded-md" />
    </div>
  </div>
);

// ─── Generic card-grid skeleton (Suppliers, Patients) ────────────────────────
export const CardGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
        </div>
        <div className="space-y-2 pt-2 border-t border-border/50">
          <Skeleton className="h-3.5 w-full rounded-md" />
          <Skeleton className="h-3.5 w-2/3 rounded-md" />
          <Skeleton className="h-3.5 w-1/2 rounded-md" />
        </div>
      </div>
    ))}
  </>
);

// ─── Generic list-row skeleton (Expenses, AuditLogs) ─────────────────────────
export const ListRowSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
          <div className="space-y-1.5 min-w-0">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full shrink-0" />
      </div>
    ))}
  </div>
);
