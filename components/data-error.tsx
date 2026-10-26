export function DataError({ what, errors }: { what: string; errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div role="alert" className="rounded-xl border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
      <p className="font-semibold">Couldn&apos;t load {what}.</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
