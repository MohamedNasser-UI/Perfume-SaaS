import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, mediaUrl, uploadFile } from "@/lib/api";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";
import { paginate, TablePager } from "@/components/table-pager";

const tabs = [
  { id: "oils", key: "products.oils", path: "/oils", fields: ["name"] },
  { id: "alcohol", key: "products.alcohol", path: "/alcohols", fields: ["name"] },
  { id: "stabilizers", key: "products.stabilizers", path: "/stabilizers", fields: ["name"] },
  { id: "pumps", key: "products.pumps", path: "/pumps", fields: ["name"] },
  { id: "bottles", key: "products.bottles" },
  { id: "packaging", key: "products.packaging" },
  { id: "readyMade", key: "products.readyMade" },
  { id: "others", key: "products.others" },
] as const;

export function ProductsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("oils");
  const current = tabs.find((x) => x.id === tab)!;
  return (
    <div>
      <PageHeader title={t("products.title")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button key={item.id} variant={tab === item.id ? "primary" : "outline"} onClick={() => setTab(item.id)}>
            {t(item.key)}
          </Button>
        ))}
      </div>
      {"path" in current && current.path ? (
        <SimpleMaster path={current.path} fields={[...current.fields]} />
      ) : null}
      {tab === "bottles" && <BottlesMaster />}
      {tab === "packaging" && <PackagingMaster />}
      {tab === "readyMade" && <ReadyMaster />}
      {tab === "others" && <OthersMaster />}
    </div>
  );
}

function fieldLabel(field: string, t: (key: MessageKey) => string) {
  if (field === "code") return t("products.code");
  if (field === "name") return t("name");
  if (field === "sku") return t("products.sku");
  if (field === "brand") return t("products.brand");
  if (field === "barcode") return t("products.barcode");
  return field;
}

function catalogErrorMessage(err: unknown, t: (key: MessageKey) => string) {
  const body = err instanceof ApiError ? err.body : null;
  const code = body && typeof body === "object" && "code" in body ? String((body as { code: unknown }).code) : "";
  if (code === "ITEM_HAS_STOCK") return t("products.cannotDeleteWithStock");
  if (code === "ITEM_IN_USE") return t("products.cannotDeleteInUse");
  return err instanceof Error ? err.message : t("products.cannotDeleteWithStock");
}

function AssignedCodeField({ value }: { value: string }) {
  const { t } = useI18n();
  return (
    <div>
      <Label>{t("products.code")}</Label>
      <Input value={value} disabled readOnly className="bg-stone-100 text-stone-600" />
    </div>
  );
}

function CatalogRowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button type="button" variant="outline" onClick={onEdit}>
        {t("edit")}
      </Button>
      <Button type="button" variant="danger" className="bg-black text-white hover:bg-neutral-900" onClick={onDelete}>
        {t("delete")}
      </Button>
    </div>
  );
}

function SimpleMaster({ path, fields }: { path: string; fields: string[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: [path], queryFn: () => api<any[]>(path) });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Record<string, string>>({});
  const paged = paginate(data ?? [], page);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignedCode, setAssignedCode] = useState("");

  const mutate = useMutation({
    mutationFn: () =>
      api(editingId ? `${path}/${editingId}` : path, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success(editingId ? t("products.updated") : t("products.saved"));
      setForm({});
      setEditingId(null);
      setAssignedCode("");
      qc.invalidateQueries({ queryKey: [path] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`${path}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("products.deleted"));
      if (editingId) {
        setEditingId(null);
        setForm({});
        setAssignedCode("");
      }
      qc.invalidateQueries({ queryKey: [path] });
    },
    onError: (e: Error) => toast.error(catalogErrorMessage(e, t)),
  });

  function onDelete(id: string) {
    if (!window.confirm(t("products.confirmDelete"))) return;
    remove.mutate(id);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <AssignedCodeField value={editingId ? assignedCode : ""} />
        {fields.map((f) => (
          <div key={f}>
            <Label>{fieldLabel(f, t)}</Label>
            <Input value={form[f] ?? ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
          </div>
        ))}
        <div className="flex gap-2">
          <Button onClick={() => mutate.mutate()}>{editingId ? t("save") : t("create")}</Button>
          {editingId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setForm({});
                setAssignedCode("");
              }}
            >
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      </Card>
      <Card>
        {paged.slice.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b py-2 text-sm last:border-0">
            <div className="min-w-0 flex-1">
              {r.code} · {r.name || r.design}
            </div>
            <CatalogRowActions
              onEdit={() => {
                setEditingId(r.id);
                setAssignedCode(String(r.code ?? ""));
                setForm(Object.fromEntries(fields.map((f) => [f, String(r[f] ?? "")])));
              }}
              onDelete={() => onDelete(r.id)}
            />
          </div>
        ))}
        <TablePager page={paged.current} pageCount={paged.pageCount} onPage={setPage} />
      </Card>
    </div>
  );
}

function BottlesMaster() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const bottles = useQuery({ queryKey: ["/bottles"], queryFn: () => api<any[]>("/bottles") });
  const pumps = useQuery({ queryKey: ["/pumps"], queryFn: () => api<any[]>("/pumps") });
  const [page, setPage] = useState(1);
  const paged = paginate(bottles.data ?? [], page);
  const empty = { design: "Classic", sizeMl: 100, pumpId: "" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignedCode, setAssignedCode] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useObjectUrl(photo);

  function refreshBottles() {
    qc.invalidateQueries({ queryKey: ["/bottles"] });
    qc.invalidateQueries({ queryKey: ["bottles"] });
  }

  const mutate = useMutation({
    mutationFn: async () => {
      const payload = { ...form, pumpId: form.pumpId || null };
      if (editingId) {
        await api(`/bottles/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        if (photo) await uploadFile(`/bottles/${editingId}/image`, photo);
        return;
      }
      const bottle = await api<{ id: string }>("/bottles", {
        method: "POST",
        body: JSON.stringify({ ...form, pumpId: form.pumpId || undefined }),
      });
      if (photo) await uploadFile(`/bottles/${bottle.id}/image`, photo);
    },
    onSuccess: () => {
      toast.success(editingId ? t("products.updated") : t("products.bottleCreated"));
      setForm(empty);
      setEditingId(null);
      setAssignedCode("");
      setPhoto(null);
      refreshBottles();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/bottles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("products.deleted"));
      setEditingId(null);
      setForm(empty);
      setAssignedCode("");
      refreshBottles();
    },
    onError: (e: Error) => toast.error(catalogErrorMessage(e, t)),
  });

  const uploadExisting = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadFile(`/bottles/${id}/image`, file),
    onSuccess: () => {
      toast.success(t("products.photoUploaded"));
      refreshBottles();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function pickPhoto(file: File | null, existingId?: string) {
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error(t("products.photoTooLarge"));
      return;
    }
    if (existingId && file) uploadExisting.mutate({ id: existingId, file });
    else setPhoto(file);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10.5rem] sm:items-start">
          <div className="space-y-3">
            <AssignedCodeField value={editingId ? assignedCode : ""} />
            <div>
              <Label>{t("products.design")}</Label>
              <Input value={form.design} onChange={(e) => setForm({ ...form, design: e.target.value })} />
            </div>
            <div>
              <Label>{t("products.sizeMl")}</Label>
              <Input type="number" value={form.sizeMl} onChange={(e) => setForm({ ...form, sizeMl: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("products.pump")}</Label>
              <Select value={form.pumpId} onChange={(e) => setForm({ ...form, pumpId: e.target.value })}>
                <option value="">{t("none")}</option>
                {(pumps.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <BottlePhotoField
            previewUrl={preview}
            label={t("products.photo")}
            hint={t("products.photoHint")}
            onFile={(file) => pickPhoto(file)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => mutate.mutate()}>{editingId ? t("save") : t("create")}</Button>
          {editingId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setForm(empty);
                setAssignedCode("");
                setPhoto(null);
              }}
            >
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      </Card>
      <Card>
        {paged.slice.map((b) => (
          <div key={b.id} className="flex items-center gap-3 border-b py-2 text-sm last:border-0">
            <BottlePhotoField
              compact
              previewUrl={mediaUrl(b.imageUrl)}
              label={b.imageUrl ? t("products.changePhoto") : t("products.addPhoto")}
              hint={t("products.addPhoto")}
              onFile={(file) => pickPhoto(file, b.id)}
            />
            <div className="min-w-0 flex-1">
              {b.code} · {b.design} {b.sizeMl}ml {b.pump ? `→ ${b.pump.name}` : ""}
            </div>
            <CatalogRowActions
              onEdit={() => {
                setEditingId(b.id);
                setAssignedCode(b.code);
                setForm({
                  design: b.design,
                  sizeMl: Number(b.sizeMl),
                  pumpId: b.pumpId ?? "",
                });
                setPhoto(null);
              }}
              onDelete={() => {
                if (!window.confirm(t("products.confirmDelete"))) return;
                remove.mutate(b.id);
              }}
            />
          </div>
        ))}
        <TablePager page={paged.current} pageCount={paged.pageCount} onPage={setPage} />
      </Card>
    </div>
  );
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function BottlePhotoField({
  previewUrl,
  label,
  hint,
  onFile,
  compact,
}: {
  previewUrl?: string;
  label: string;
  hint: string;
  onFile: (file: File | null) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={compact ? "shrink-0" : undefined}>
      {!compact ? <Label>{label}</Label> : null}
      <button
        type="button"
        title={label}
        onClick={() => inputRef.current?.click()}
        className={
          compact
            ? "flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-paper hover:border-gold"
            : "mt-1 flex h-36 w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-stone-300 bg-paper text-center text-xs text-stone-500 hover:border-gold"
        }
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className={compact ? "text-lg text-stone-400" : "px-3"}>{compact ? "+" : hint}</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PackagingMaster() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["/packaging"], queryFn: () => api<any[]>("/packaging") });
  const [page, setPage] = useState(1);
  const paged = paginate(data ?? [], page);
  const empty = { name: "", type: "STANDARD_BOX" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignedCode, setAssignedCode] = useState("");
  const mutate = useMutation({
    mutationFn: () =>
      api(editingId ? `/packaging/${editingId}` : "/packaging", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success(editingId ? t("products.updated") : t("products.saved"));
      setForm(empty);
      setEditingId(null);
      setAssignedCode("");
      qc.invalidateQueries({ queryKey: ["/packaging"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/packaging/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("products.deleted"));
      setEditingId(null);
      setForm(empty);
      setAssignedCode("");
      qc.invalidateQueries({ queryKey: ["/packaging"] });
    },
    onError: (e: Error) => toast.error(catalogErrorMessage(e, t)),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <AssignedCodeField value={editingId ? assignedCode : ""} />
        <Label>{t("name")}</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Label>{t("type")}</Label>
        <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="STANDARD_BOX">{t("products.standardBox")}</option>
          <option value="PREMIUM_BOX">{t("products.premiumBox")}</option>
          <option value="GIFT_WRAPPING">{t("products.giftWrap")}</option>
        </Select>
        <div className="flex gap-2">
          <Button onClick={() => mutate.mutate()}>{editingId ? t("save") : t("create")}</Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(empty); setAssignedCode(""); }}>
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      </Card>
      <Card>
        {paged.slice.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-b py-2 text-sm last:border-0">
            <div className="min-w-0 flex-1">{p.code} · {p.name}</div>
            <CatalogRowActions
              onEdit={() => {
                setEditingId(p.id);
                setAssignedCode(p.code);
                setForm({ name: p.name, type: p.type });
              }}
              onDelete={() => {
                if (!window.confirm(t("products.confirmDelete"))) return;
                remove.mutate(p.id);
              }}
            />
          </div>
        ))}
        <TablePager page={paged.current} pageCount={paged.pageCount} onPage={setPage} />
      </Card>
    </div>
  );
}

function ReadyMaster() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["/products"], queryFn: () => api<any[]>("/products") });
  const [page, setPage] = useState(1);
  const paged = paginate(data ?? [], page);
  const empty = { name: "", brand: "", classification: "ORIGINAL", sizeMl: 100, barcode: "", sellingPrice: 0 };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignedCode, setAssignedCode] = useState("");
  const mutate = useMutation({
    mutationFn: () =>
      api(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success(editingId ? t("products.updated") : t("products.saved"));
      setForm(empty);
      setEditingId(null);
      setAssignedCode("");
      qc.invalidateQueries({ queryKey: ["/products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("products.deleted"));
      setEditingId(null);
      setForm(empty);
      setAssignedCode("");
      qc.invalidateQueries({ queryKey: ["/products"] });
    },
    onError: (e: Error) => toast.error(catalogErrorMessage(e, t)),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <AssignedCodeField value={editingId ? assignedCode : ""} />
        {(["name", "brand", "barcode"] as const).map((f) => (
          <div key={f}>
            <Label>{fieldLabel(f, t)}</Label>
            <Input value={(form as any)[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
          </div>
        ))}
        <Label>{t("products.classification")}</Label>
        <Select value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })}>
          <option value="ORIGINAL">{t("products.original")}</option>
          <option value="HIGH_COPY">{t("products.highCopy")}</option>
        </Select>
        <Label>{t("products.sizeMl")}</Label>
        <Input type="number" value={form.sizeMl} onChange={(e) => setForm({ ...form, sizeMl: Number(e.target.value) })} />
        <Label>{t("products.sellingPrice")}</Label>
        <Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
        <div className="flex gap-2">
          <Button onClick={() => mutate.mutate()}>{editingId ? t("save") : t("create")}</Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(empty); setAssignedCode(""); }}>
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      </Card>
      <Card>
        {paged.slice.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-b py-2 text-sm last:border-0">
            <div className="min-w-0 flex-1">
              {p.sku} · {p.name} · {p.classification}
            </div>
            <CatalogRowActions
              onEdit={() => {
                setEditingId(p.id);
                setAssignedCode(p.sku);
                setForm({
                  name: p.name,
                  brand: p.brand ?? "",
                  classification: p.classification,
                  sizeMl: Number(p.sizeMl),
                  barcode: p.barcode ?? "",
                  sellingPrice: Number(p.sellingPrice),
                });
              }}
              onDelete={() => {
                if (!window.confirm(t("products.confirmDelete"))) return;
                remove.mutate(p.id);
              }}
            />
          </div>
        ))}
        <TablePager page={paged.current} pageCount={paged.pageCount} onPage={setPage} />
      </Card>
    </div>
  );
}

function OthersMaster() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["/others"], queryFn: () => api<any[]>("/others") });
  const [page, setPage] = useState(1);
  const paged = paginate(data ?? [], page);
  const empty = { name: "", sellingPrice: 0 };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignedCode, setAssignedCode] = useState("");
  const mutate = useMutation({
    mutationFn: () =>
      api(editingId ? `/others/${editingId}` : "/others", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success(editingId ? t("products.updated") : t("products.saved"));
      setForm(empty);
      setEditingId(null);
      setAssignedCode("");
      qc.invalidateQueries({ queryKey: ["/others"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/others/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("products.deleted"));
      setEditingId(null);
      setForm(empty);
      setAssignedCode("");
      qc.invalidateQueries({ queryKey: ["/others"] });
    },
    onError: (e: Error) => toast.error(catalogErrorMessage(e, t)),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <AssignedCodeField value={editingId ? assignedCode : ""} />
        <div>
          <Label>{t("name")}</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label>{t("products.sellingPrice")}</Label>
          <Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => mutate.mutate()}>{editingId ? t("save") : t("create")}</Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(empty); setAssignedCode(""); }}>
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      </Card>
      <Card>
        {paged.slice.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-b py-2 text-sm last:border-0">
            <div className="min-w-0 flex-1">
              {p.sku} · {p.name}
            </div>
            <CatalogRowActions
              onEdit={() => {
                setEditingId(p.id);
                setAssignedCode(p.sku);
                setForm({ name: p.name, sellingPrice: Number(p.sellingPrice) });
              }}
              onDelete={() => {
                if (!window.confirm(t("products.confirmDelete"))) return;
                remove.mutate(p.id);
              }}
            />
          </div>
        ))}
        <TablePager page={paged.current} pageCount={paged.pageCount} onPage={setPage} />
      </Card>
    </div>
  );
}
