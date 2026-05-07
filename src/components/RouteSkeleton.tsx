import { AppLayout } from "@/components/AppLayout";

/** Skeleton consistente para rotas em estado pendente. */
export function RouteSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <AppLayout>
      <div className="space-y-4 p-2">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted/70" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-14 w-full animate-pulse rounded-md bg-muted/60"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
