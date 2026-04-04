type Item = {
  key: string;
  value: boolean | number | string | null | undefined;
};

type Props = {
  items?: Item[];
  rows?: Item[];
};

/** Renders a simple key/value table for compact operational data. */
export function KeyValueTable({ items, rows }: Props) {
  const entries = items ?? rows ?? [];

  return (
    <div className="kv-table">
      {entries.map((item) => (
        <div className="kv-row" key={item.key}>
          <div className="kv-key">{item.key}</div>
          <div className="kv-value">{item.value == null ? '—' : String(item.value)}</div>
        </div>
      ))}
    </div>
  );
}
