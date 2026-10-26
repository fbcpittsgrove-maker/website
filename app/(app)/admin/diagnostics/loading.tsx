export default function DiagnosticsLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-inset" />
        <div className="h-8 w-52 rounded bg-inset" />
        <div className="h-4 w-96 max-w-full rounded bg-inset" />
      </div>
      <div className="h-20 rounded-xl border border-border bg-surface" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-56 rounded-xl border border-border bg-surface" />
        <div className="h-56 rounded-xl border border-border bg-surface" />
      </div>
    </div>
  );
}
