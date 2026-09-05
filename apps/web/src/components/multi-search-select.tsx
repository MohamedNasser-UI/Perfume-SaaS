import { useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export type MultiSearchItem = {
  id: string;
  label: string;
  hint?: string;
};

export function MultiSearchSelect({
  items,
  selectedIds,
  onChange,
  disabledIds = [],
  placeholder,
  emptyLabel,
}: {
  items: MultiSearchItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabledIds?: string[];
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const disabled = useMemo(() => new Set(disabledIds), [disabledIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = `${item.label} ${item.hint ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  function toggle(id: string) {
    if (disabled.has(id)) return;
    if (selected.has(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  }

  return (
    <div className="space-y-2">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
      <div className="max-h-56 overflow-auto rounded-xl border border-stone-200">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-sm text-stone-500">{emptyLabel}</p>
        ) : (
          filtered.map((item) => {
            const isOn = selected.has(item.id);
            const isDisabled = disabled.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={isDisabled}
                onClick={() => toggle(item.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border-b border-stone-100 px-3 py-2 text-start text-sm last:border-b-0",
                  isDisabled && "cursor-not-allowed bg-stone-50 text-stone-400",
                  !isDisabled && isOn && "bg-gold/10",
                  !isDisabled && !isOn && "hover:bg-stone-50",
                )}
              >
                <span>
                  <span className="font-medium">{item.label}</span>
                  {item.hint ? <span className="ms-2 text-xs text-stone-500">{item.hint}</span> : null}
                </span>
                <span className={cn("text-xs font-semibold", isOn || isDisabled ? "text-gold" : "text-stone-300")}>
                  {isOn || isDisabled ? "✓" : ""}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
