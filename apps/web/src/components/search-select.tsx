import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export type SearchSelectItem = {
  id: string;
  label: string;
  hint?: string;
};

export function SearchSelect({
  items,
  value,
  onChange,
  placeholder,
  emptyLabel,
}: {
  items: SearchSelectItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = items.find((item) => item.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.label} ${item.hint ?? ""}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={box} className="relative">
      <Input
        value={open ? query : selected?.label ?? ""}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
      />
      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-stone-500">{emptyLabel}</p>
          ) : (
            filtered.map((item) => {
              const isOn = item.id === value;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 border-b border-stone-100 px-3 py-2 text-start text-sm last:border-b-0",
                    isOn ? "bg-gold/10" : "hover:bg-stone-50",
                  )}
                >
                  <span>
                    <span className="font-medium">{item.label}</span>
                    {item.hint ? <span className="ms-2 text-xs text-stone-500">{item.hint}</span> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
