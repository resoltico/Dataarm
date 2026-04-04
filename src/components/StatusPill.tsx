/** Shows a compact status token using the shared pill styling. */
export function StatusPill({ value }: { value: string }) {
  return <span className={`pill pill-${value.toLowerCase()}`}>{value}</span>;
}
