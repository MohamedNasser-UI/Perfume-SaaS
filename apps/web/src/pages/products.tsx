import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, mediaUrl, uploadFile } from "@/lib/api";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";

const tabs = [
  { id: "oils", key: "products.oils", path: "/oils", fields: ["code", "name"] },
  { id: "alcohol", key: "products.alcohol", path: "/alcohols", fields: ["code", "name"] },
  { id: "stabilizers", key: "products.stabilizers", path: "/stabilizers", fields: ["code", "name"] },
  { id: "pumps", key: "products.pumps", path: "/pumps", fields: ["code", "name"] },
  { id: "bottles", key: "products.bottles" },
  { id: "packaging", key: "products.packaging" },
  { id: "readyMade", key: "products.readyMade" },
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

function SimpleMaster({ path, fields }: { path: string; fields: string[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: [path], queryFn: () => api<any[]>(path) });
  const [form, setForm] = useState<Record<string, string>>({});
  const mutate = useMutation({
    mutationFn: () => api(path, { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success(t("products.saved"));
      qc.invalidateQueries({ queryKey: [path] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        {fields.map((f) => (
          <div key={f}>
            <Label>{fieldLabel(f, t)}</Label>
            <Input value={form[f] ?? ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
          </div>
        ))}
        <Button onClick={() => mutate.mutate()}>{t("create")}</Button>
      </Card>
      <Card>
        {(data ?? []).map((r) => (
          <div key={r.id} className="border-b py-2 text-sm">
            {r.code} · {r.name || r.design}
          </div>
        ))}
      </Card>
    </div>
  );
}

function BottlesMaster() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const bottles = useQuery({ queryKey: ["/bottles"], queryFn: () => api<any[]>("/bottles") });
  const pumps = useQuery({ queryKey: ["/pumps"], queryFn: () => api<any[]>("/pumps") });
  const [form, setForm] = useState({ code: "", design: "Classic", sizeMl: 100, pumpId: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useObjectUrl(photo);

  function refreshBottles() {
    qc.invalidateQueries({ queryKey: ["/bottles"] });
    qc.invalidateQueries({ queryKey: ["bottles"] });
  }

  const mutate = useMutation({
    mutationFn: async () => {
      const bottle = await api<{ id: string }>("/bottles", {
        method: "POST",
        body: JSON.stringify({ ...form, pumpId: form.pumpId || undefined }),
      });
      if (photo) await uploadFile(`/bottles/${bottle.id}/image`, photo);
    },
    onSuccess: () => {
      toast.success(t("products.bottleCreated"));
      setForm({ code: "", design: "Classic", sizeMl: 100, pumpId: "" });
      setPhoto(null);
      refreshBottles();
    },
    onError: (e: Error) => toast.error(e.message),
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
            <div>
              <Label>{t("products.code")}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
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
        <Button onClick={() => mutate.mutate()}>{t("create")}</Button>
      </Card>
      <Card>
        {(bottles.data ?? []).map((b) => (
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
          </div>
        ))}
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
  const [form, setForm] = useState({ code: "", name: "", type: "STANDARD_BOX" });
  const mutate = useMutation({
    mutationFn: () => api("/packaging", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success(t("products.saved"));
      qc.invalidateQueries({ queryKey: ["/packaging"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <Label>{t("products.code")}</Label>
        <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <Label>{t("name")}</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Label>{t("type")}</Label>
        <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="STANDARD_BOX">{t("products.standardBox")}</option>
          <option value="PREMIUM_BOX">{t("products.premiumBox")}</option>
          <option value="GIFT_WRAPPING">{t("products.giftWrap")}</option>
        </Select>
        <Button onClick={() => mutate.mutate()}>{t("create")}</Button>
      </Card>
      <Card>
        {(data ?? []).map((p) => (
          <div key={p.id} className="border-b py-2 text-sm">{p.code} · {p.name}</div>
        ))}
      </Card>
    </div>
  );
}

function ReadyMaster() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["/products"], queryFn: () => api<any[]>("/products") });
  const [form, setForm] = useState({ sku: "", name: "", brand: "", classification: "ORIGINAL", sizeMl: 100, barcode: "", sellingPrice: 0 });
  const mutate = useMutation({
    mutationFn: () => api("/products", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success(t("products.saved"));
      qc.invalidateQueries({ queryKey: ["/products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        {(["sku", "name", "brand", "barcode"] as const).map((f) => (
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
        <Button onClick={() => mutate.mutate()}>{t("create")}</Button>
      </Card>
      <Card>
        {(data ?? []).map((p) => (
          <div key={p.id} className="border-b py-2 text-sm">
            {p.sku} · {p.name} · {p.classification}
          </div>
        ))}
      </Card>
    </div>
  );
}
