export type ReconcilableOutlet = {
  id: string;
  active?: boolean;
  isDefault?: boolean;
};

export function reconcileOutletId(storedId: string | null | undefined, outlets: ReconcilableOutlet[]): string | null {
  const usable = outlets.filter((outlet) => outlet.active !== false);
  const list = usable.length ? usable : outlets;
  if (!list.length) return storedId ?? null;
  if (storedId && list.some((outlet) => outlet.id === storedId)) return storedId;
  const preferred = list.find((outlet) => outlet.isDefault) ?? list[0];
  return preferred?.id ?? null;
}

export function persistReconciledOutletId(outlets: ReconcilableOutlet[]): string | null {
  const stored = typeof localStorage === "undefined" ? null : localStorage.getItem("outletId");
  const next = reconcileOutletId(stored, outlets);
  if (typeof localStorage === "undefined") return next;
  if (next) localStorage.setItem("outletId", next);
  else localStorage.removeItem("outletId");
  if (stored && next && stored !== next) {
    console.info("outlet ID reconciled", { from: stored, to: next });
  } else if (!stored && next) {
    console.info("outlet ID reconciled", { from: null, to: next });
  }
  return next;
}
