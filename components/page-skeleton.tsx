/** Route-shaped ghost for list pages — keeps navigation feeling instant. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded bg-inset" />
        <div className="h-4 w-80 max-w-full rounded bg-inset" />
      </div>
      <div className="h-9 w-36 rounded-lg bg-inset" />
      <div className="space-y-px overflow-hidden rounded-xl border border-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-surface" />
        ))}
      </div>
    </div>
  );
}
