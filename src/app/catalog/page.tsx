"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { BodyMap, OptionGrid, PriceCalculator, SelectableOption, StepIndicator } from "@/components/catalog/Wizard";
import { BodyRegionMeta } from "@/lib/medical-tree";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, PageHeader, Avatar } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { formatDateHe } from "@/lib/utils";
import {
  CATALOG_CODE_LABELS,
  CATALOG_KIND_LABELS,
  CATALOG_KINDS,
  CATALOG_REQUEST_STATUS_LABELS,
  CatalogItem,
  CatalogKind,
  CatalogRequest,
  CatalogRequestStatus,
  PriceByLayer,
  PROVIDER_SERVICE_TYPE_LABELS,
  ProviderProfile,
  ProviderServiceType,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  ServiceType,
  SkillDomain,
  SkillSubdomain,
} from "@/types";
import {
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  LayoutGrid,
  Search,
  Inbox,
  Check,
  GitMerge,
  MessageSquareText,
  Ban,
} from "lucide-react";

export default function AdminCatalogPage() {
  const pendingRequests = useStore(
    (s) => s.catalogRequests.filter((r) => r.status === "pending").length
  );
  return (
    <AppLayout>
      <PageHeader
        title="קטלוגי פריטים"
        description='שני קטלוגים נפרדים — קטלוג מב"ר (קודי משרד הבריאות, תעריפי S/H) וקטלוג הילסון (קודי הילסון, מחיר P ותעריפי K/B). ניהול התחומים ותתי-התחומים עבר לעמוד "תחומים רפואיים"'
      />

      <Tabs defaultValue="browse">
        <TabsList className="mb-5 max-w-md">
          <TabsTrigger value="browse" icon={<Search className="h-3.5 w-3.5" />}>עיון</TabsTrigger>
          <TabsTrigger value="manage" icon={<LayoutGrid className="h-3.5 w-3.5" />}>ניהול פריטים</TabsTrigger>
          <TabsTrigger value="requests" icon={<Inbox className="h-3.5 w-3.5" />}>
            <span className="flex items-center gap-1.5">
              בקשות קטלוג
              {pendingRequests > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[11px] font-bold tabular-nums text-white">
                  {pendingRequests}
                </span>
              )}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="browse">
          <BrowseWizard />
        </TabsContent>
        <TabsContent value="manage">
          <ItemsManager />
        </TabsContent>
        <TabsContent value="requests">
          <CatalogRequestsManager />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function BrowseWizard() {
  const catalog = useStore((s) => s.catalog);
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const providers = useStore((s) => s.providers);

  const [step, setStep] = useState(0);
  const [bodyRegion, setBodyRegion] = useState<BodyRegionMeta | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [subdomainId, setSubdomainId] = useState<string | null>(null);

  const activeCatalog = useMemo(() => catalog.filter((c) => c.is_active), [catalog]);

  const domainOptions: SelectableOption[] = useMemo(() => {
    const usedIds = new Set(activeCatalog.map((i) => i.skill_domain_id));
    const list = skillDomains
      .filter((d) => usedIds.has(d.id))
      .map((d) => ({ id: d.id, label: d.name_he }));
    if (bodyRegion) {
      list.sort((a, b) => {
        const aPriority = bodyRegion.domains.includes(a.label) ? -1 : 0;
        const bPriority = bodyRegion.domains.includes(b.label) ? -1 : 0;
        return aPriority - bPriority;
      });
    }
    return list;
  }, [activeCatalog, skillDomains, bodyRegion]);

  const subdomainOptions: SelectableOption[] = useMemo(() => {
    if (!domainId) return [];
    const usedIds = new Set(
      activeCatalog.filter((i) => i.skill_domain_id === domainId).map((i) => i.skill_subdomain_id)
    );
    return skillSubdomains
      .filter((sd) => sd.domain_id === domainId && usedIds.has(sd.id))
      .map((sd) => ({ id: sd.id, label: sd.name_he }));
  }, [activeCatalog, skillSubdomains, domainId]);

  const results = useMemo(() => {
    if (!domainId || !subdomainId) return [];
    return activeCatalog.filter((i) => i.skill_domain_id === domainId && i.skill_subdomain_id === subdomainId);
  }, [activeCatalog, domainId, subdomainId]);

  const domainLabel = skillDomains.find((d) => d.id === domainId)?.name_he;
  const subdomainLabel = skillSubdomains.find((sd) => sd.id === subdomainId)?.name_he;

  function handleReset() {
    setStep(0);
    setBodyRegion(null);
    setDomainId(null);
    setSubdomainId(null);
  }

  return (
    <div className="max-w-lg">
      <StepIndicator step={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {step === 0 && (
            <BodyMap
              onSelect={(region) => {
                setBodyRegion(region);
                setStep(1);
              }}
            />
          )}

          {step === 1 && (
            <div>
              <Breadcrumb label={bodyRegion?.label} onBack={() => setStep(0)} />
              {domainOptions.length === 0 ? (
                <EmptyState title="לא נמצאו תחומים זמינים" action={<ResetButton onReset={handleReset} />} />
              ) : (
                <OptionGrid
                  options={domainOptions}
                  onSelect={(id) => {
                    setDomainId(id);
                    setStep(2);
                  }}
                />
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <Breadcrumb label={domainLabel} onBack={() => setStep(1)} />
              {subdomainOptions.length === 0 ? (
                <EmptyState title="לא נמצאו תתי-תחומים" action={<ResetButton onReset={handleReset} />} />
              ) : (
                <OptionGrid
                  options={subdomainOptions}
                  onSelect={(id) => {
                    setSubdomainId(id);
                    setStep(3);
                  }}
                />
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[bodyRegion?.label, domainLabel, subdomainLabel].filter(Boolean).map((chip, i) => (
                  <span key={`${i}-${chip}`} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {chip}
                  </span>
                ))}
              </div>
              <p className="text-sm text-slate-500 mb-3">תוצאות ({results.length})</p>
              {results.length === 0 ? (
                <EmptyState title="לא נמצאו פריטים" action={<ResetButton onReset={handleReset} />} />
              ) : (
                <div className="flex flex-col gap-3">
                  {results.map((item) => {
                    const provider = providers.find((p) => p.id === item.provider_id);
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{item.name_he}</p>
                            <p className="text-xs text-slate-400">
                              {CATALOG_CODE_LABELS[item.catalog]}: {item.tavar_code}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {SERVICE_TYPE_LABELS[item.service_type]}
                              {provider && ` · ${provider.title ?? ""} ${provider.display_name}`}
                            </p>
                            {item.requires_referral && (
                              <Badge tone="amber" className="mt-1.5">דורש הפניה</Badge>
                            )}
                          </div>
                          <PriceCalculator item={item} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button variant="outline" className="w-full mt-4" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" /> חיפוש חדש
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Breadcrumb({ label, onBack }: { label?: string; onBack: () => void }) {
  if (!label) return null;
  return (
    <button onClick={onBack} className="mb-4 text-sm text-primary hover:underline">
      ← {label} · שנה
    </button>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onReset}>
      <RotateCcw className="h-4 w-4" /> חיפוש מחדש
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Management tab — CRUD for catalog items (ADM-03). Domain / sub-domain
// management moved to its own page: /medical-tree ("תחומים רפואיים").
// ---------------------------------------------------------------------------
interface ItemFormValues {
  name_he: string;
  tavar_code: string;
  catalog: CatalogKind;
  skill_domain_id: string;
  skill_subdomain_id: string;
  service_type: ServiceType;
  // מב"ר: S+H מחירון משרד הבריאות. הילסון: P מלא + K/B תעריפי הילסון,
  // כש-S/H תמיד לפי מחירון משרד הבריאות.
  price_s: string;
  price_k: string;
  price_b: string;
  price_h: string;
  price_full: string;
  typical_duration_min: string;
  requires_referral: boolean;
  provider_id: string;
  is_active: boolean;
}

function priceOf(item: CatalogItem, layer: PriceByLayer["layer"]): string {
  const v = item.layer_prices?.find((p) => p.layer === layer)?.price;
  return v != null ? String(v) : "";
}

function makeEmptyForm(
  skillDomains: SkillDomain[],
  skillSubdomains: SkillSubdomain[],
  catalog: CatalogKind = "mabar"
): ItemFormValues {
  return {
    name_he: "",
    tavar_code: "",
    catalog,
    skill_domain_id: skillDomains[0]?.id ?? "",
    skill_subdomain_id: skillSubdomains.find((sd) => sd.domain_id === skillDomains[0]?.id)?.id ?? "",
    service_type: "consultation",
    price_s: "",
    price_k: "",
    price_b: "",
    price_h: "",
    price_full: "",
    typical_duration_min: "",
    requires_referral: false,
    provider_id: "",
    is_active: true,
  };
}

function formFromItem(item: CatalogItem): ItemFormValues {
  return {
    name_he: item.name_he,
    tavar_code: item.tavar_code ?? "",
    catalog: item.catalog,
    skill_domain_id: item.skill_domain_id,
    skill_subdomain_id: item.skill_subdomain_id,
    service_type: item.service_type,
    price_s: priceOf(item, "S"),
    price_k: priceOf(item, "K"),
    price_b: priceOf(item, "B"),
    price_h: priceOf(item, "H"),
    price_full: item.price_full != null ? String(item.price_full) : "",
    typical_duration_min: item.typical_duration_min ? String(item.typical_duration_min) : "",
    requires_referral: item.requires_referral,
    provider_id: item.provider_id ?? "",
    is_active: item.is_active,
  };
}

// מב"ר carries S+H only (the MoH price list); Healson adds P plus its own K/B
// tariffs, with S/H still mirroring the MoH list. Single source of truth for
// turning the form into a CatalogItem — used by create/edit AND approve-request.
function buildCatalogValues(form: ItemFormValues): Omit<CatalogItem, "id"> {
  const layer_prices: PriceByLayer[] = [];
  if (form.price_s !== "") layer_prices.push({ layer: "S", price: Number(form.price_s) || 0 });
  if (form.catalog === "healson") {
    if (form.price_k !== "") layer_prices.push({ layer: "K", price: Number(form.price_k) || 0 });
    if (form.price_b !== "") layer_prices.push({ layer: "B", price: Number(form.price_b) || 0 });
  }
  if (form.price_h !== "") layer_prices.push({ layer: "H", price: Number(form.price_h) || 0 });
  return {
    name_he: form.name_he,
    tavar_code: form.tavar_code || undefined,
    catalog: form.catalog,
    skill_domain_id: form.skill_domain_id,
    skill_subdomain_id: form.skill_subdomain_id,
    service_type: form.service_type,
    // Headline price: מב"ר → the MoH S price; הילסון → the full item price P.
    base_price: form.catalog === "mabar" ? Number(form.price_s) || 0 : Number(form.price_full) || 0,
    price_full: form.catalog === "healson" ? Number(form.price_full) || 0 : undefined,
    layer_prices,
    typical_duration_min: form.typical_duration_min ? Number(form.typical_duration_min) : undefined,
    requires_referral: form.requires_referral,
    provider_id: form.provider_id || undefined,
    is_active: form.is_active,
  };
}

/** Shared create/edit form for a catalog item (fields + submit). Holds its own
 * form state seeded from `initial`; remount it with a `key` to reset. When
 * `lockCatalog` is set the catalog is fixed (used by the approve-request flow,
 * which always creates a Healson item). */
function CatalogItemForm({
  skillDomains,
  skillSubdomains,
  providers,
  initial,
  lockCatalog,
  submitLabel = "שמור",
  onSubmit,
}: {
  skillDomains: SkillDomain[];
  skillSubdomains: SkillSubdomain[];
  providers: ProviderProfile[];
  initial?: ItemFormValues;
  lockCatalog?: CatalogKind;
  submitLabel?: string;
  onSubmit: (values: Omit<CatalogItem, "id">) => void;
}) {
  const [form, setForm] = useState<ItemFormValues>(
    () => initial ?? makeEmptyForm(skillDomains, skillSubdomains, lockCatalog)
  );
  const subdomainOptionsForForm = skillSubdomains.filter((sd) => sd.domain_id === form.skill_domain_id);
  const canSave = form.name_he.trim().length > 0 && form.tavar_code.trim().length > 0;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Input
        label="שם הפריט"
        className="sm:col-span-2"
        value={form.name_he}
        onChange={(e) => setForm({ ...form, name_he: e.target.value })}
        required
      />
      <Select
        label="קטלוג"
        value={form.catalog}
        disabled={!!lockCatalog}
        onChange={(e) => setForm({ ...form, catalog: e.target.value as CatalogKind })}
      >
        {CATALOG_KINDS.map((k) => (
          <option key={k} value={k}>
            {CATALOG_KIND_LABELS[k]}
          </option>
        ))}
      </Select>
      <Input
        label={CATALOG_CODE_LABELS[form.catalog]}
        placeholder={form.catalog === "mabar" ? "לדוגמה: 54021" : "לדוגמה: HLS-20034"}
        value={form.tavar_code}
        onChange={(e) => setForm({ ...form, tavar_code: e.target.value })}
        required
      />
      <Select
        label="סוג פריט"
        value={form.service_type}
        onChange={(e) => setForm({ ...form, service_type: e.target.value as ServiceType })}
      >
        {SERVICE_TYPES.map((t) => (
          <option key={t} value={t}>
            {SERVICE_TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
      <Select
        label="תחום"
        value={form.skill_domain_id}
        onChange={(e) => {
          const domain_id = e.target.value;
          setForm({
            ...form,
            skill_domain_id: domain_id,
            skill_subdomain_id: skillSubdomains.find((sd) => sd.domain_id === domain_id)?.id ?? "",
          });
        }}
      >
        {skillDomains.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name_he}
          </option>
        ))}
      </Select>
      <Select
        label="תת-תחום"
        value={form.skill_subdomain_id}
        onChange={(e) => setForm({ ...form, skill_subdomain_id: e.target.value })}
      >
        {subdomainOptionsForForm.map((sd) => (
          <option key={sd.id} value={sd.id}>
            {sd.name_he}
          </option>
        ))}
      </Select>
      <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-xs font-medium text-slate-600">
          {form.catalog === "mabar"
            ? 'מחירון משרד הבריאות (תעריפי S ו-H בלבד)'
            : "מחירון הילסון — P מחיר פריט מלא, K/B תעריפי הילסון; S/H תמיד לפי מחירון משרד הבריאות"}
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          {form.catalog === "healson" && (
            <Input
              label="מחיר פריט מלא P (₪)"
              type="number"
              value={form.price_full}
              onChange={(e) => setForm({ ...form, price_full: e.target.value })}
              required
            />
          )}
          <Input
            label="מחיר S — משרד הבריאות (₪)"
            type="number"
            value={form.price_s}
            onChange={(e) => setForm({ ...form, price_s: e.target.value })}
            required
          />
          {form.catalog === "healson" && (
            <>
              <Input
                label="מחיר K — תעריף הילסון (₪)"
                type="number"
                value={form.price_k}
                onChange={(e) => setForm({ ...form, price_k: e.target.value })}
              />
              <Input
                label="מחיר B — תעריף הילסון (₪)"
                type="number"
                value={form.price_b}
                onChange={(e) => setForm({ ...form, price_b: e.target.value })}
              />
            </>
          )}
          <Input
            label="מחיר H — מלא לתייר (₪)"
            type="number"
            value={form.price_h}
            onChange={(e) => setForm({ ...form, price_h: e.target.value })}
            required
          />
        </div>
      </div>
      <Input
        label="משך טיפול ממוצע (דקות)"
        type="number"
        value={form.typical_duration_min}
        onChange={(e) => setForm({ ...form, typical_duration_min: e.target.value })}
      />
      <Select
        label="ספק (אופציונלי)"
        value={form.provider_id}
        onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
      >
        <option value="">ללא ספק משויך</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title} {p.display_name}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 cursor-pointer self-end">
        <input
          type="checkbox"
          checked={form.requires_referral}
          onChange={(e) => setForm({ ...form, requires_referral: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 accent-primary"
        />
        <span className="text-sm text-slate-700">דורש הפניה (טופס 17)</span>
      </label>
      <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 cursor-pointer self-end">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 accent-primary"
        />
        <span className="text-sm text-slate-700">פעיל בקטלוג הציבורי</span>
      </label>
      <Button
        onClick={() => onSubmit(buildCatalogValues(form))}
        disabled={!canSave}
        className="sm:col-span-2 mt-1"
      >
        {submitLabel}
      </Button>
    </div>
  );
}

function ItemsManager() {
  const catalog = useStore((s) => s.catalog);
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const providers = useStore((s) => s.providers);
  const addCatalogItem = useStore((s) => s.addCatalogItem);
  const updateCatalogItem = useStore((s) => s.updateCatalogItem);
  const deleteCatalogItem = useStore((s) => s.deleteCatalogItem);
  const bulkDeleteCatalogItems = useStore((s) => s.bulkDeleteCatalogItems);
  const bulkSetCatalogItemsActive = useStore((s) => s.bulkSetCatalogItemsActive);
  const showToast = useStore((s) => s.showToast);

  const [catalogFilter, setCatalogFilter] = useState<CatalogKind | "">("");
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [subdomainFilter, setSubdomainFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<ServiceType | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const subdomainOptionsForFilter = skillSubdomains.filter((sd) => sd.domain_id === domainFilter);

  const filtered = useMemo(
    () =>
      catalog.filter((c) => {
        if (catalogFilter && c.catalog !== catalogFilter) return false;
        if (query && !c.name_he.includes(query) && !(c.tavar_code ?? "").includes(query)) return false;
        if (domainFilter && c.skill_domain_id !== domainFilter) return false;
        if (subdomainFilter && c.skill_subdomain_id !== subdomainFilter) return false;
        if (typeFilter && c.service_type !== typeFilter) return false;
        if (statusFilter === "active" && !c.is_active) return false;
        if (statusFilter === "inactive" && c.is_active) return false;
        return true;
      }),
    [catalog, catalogFilter, query, domainFilter, subdomainFilter, typeFilter, statusFilter]
  );

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(item: CatalogItem) {
    setEditing(item);
    setOpen(true);
  }

  function handleSubmit(values: Omit<CatalogItem, "id">) {
    if (editing) {
      updateCatalogItem(editing.id, values);
      showToast("פריט הקטלוג עודכן", { variant: "success" });
    } else {
      addCatalogItem(values);
      showToast("פריט קטלוג חדש נוסף", { variant: "success" });
    }
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row flex-wrap gap-2">
        <CardTitle>פריטי קטלוג (Items)</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            placeholder="חיפוש לפי שם או קוד..."
            icon={<Search className="h-4 w-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-[220px]"
          />
          <Button size="sm" onClick={openCreate} disabled={skillDomains.length === 0}>
            <Plus className="h-4 w-4" /> פריט חדש
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Select
            value={catalogFilter}
            onChange={(e) => setCatalogFilter(e.target.value as CatalogKind | "")}
            className="max-w-[200px]"
          >
            <option value="">שני הקטלוגים</option>
            {CATALOG_KINDS.map((k) => (
              <option key={k} value={k}>
                {CATALOG_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
          <Select
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value);
              setSubdomainFilter("");
            }}
            className="max-w-[180px]"
          >
            <option value="">כל התחומים</option>
            {skillDomains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_he}
              </option>
            ))}
          </Select>
          <Select
            value={subdomainFilter}
            onChange={(e) => setSubdomainFilter(e.target.value)}
            disabled={!domainFilter}
            className="max-w-[180px]"
          >
            <option value="">כל תתי-התחומים</option>
            {subdomainOptionsForFilter.map((sd) => (
              <option key={sd.id} value={sd.id}>
                {sd.name_he}
              </option>
            ))}
          </Select>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ServiceType | "")}
            className="max-w-[160px]"
          >
            <option value="">כל סוגי הפריטים</option>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {SERVICE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
            className="max-w-[140px]"
          >
            <option value="">כל הסטטוסים</option>
            <option value="active">פעיל</option>
            <option value="inactive">מושבת</option>
          </Select>
          {(catalogFilter || domainFilter || subdomainFilter || typeFilter || statusFilter) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCatalogFilter("");
                setDomainFilter("");
                setSubdomainFilter("");
                setTypeFilter("");
                setStatusFilter("");
              }}
            >
              נקה סינון
            </Button>
          )}
        </div>
        <DataTable<CatalogItem>
          rows={filtered}
          rowKey={(c) => c.id}
          emptyIcon={<LayoutGrid className="h-10 w-10" />}
          emptyTitle="אין פריטי קטלוג"
          selectable
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          bulkActions={(ids, clearSelection) => (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  bulkSetCatalogItemsActive(ids, true);
                  showToast(`${ids.length} פריטים הופעלו`, { variant: "success" });
                  clearSelection();
                }}
              >
                הפעל
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  bulkSetCatalogItemsActive(ids, false);
                  showToast(`${ids.length} פריטים הושבתו`, { variant: "success" });
                  clearSelection();
                }}
              >
                השבת
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> מחק
              </Button>
            </>
          )}
          columns={
            [
              {
                key: "name",
                header: "שם הפריט",
                render: (c) => (
                  <div>
                    <p className="font-medium text-slate-900">{c.name_he}</p>
                    <p className="text-xs text-slate-400">{c.tavar_code}</p>
                  </div>
                ),
              },
              {
                key: "catalog",
                header: "קטלוג",
                render: (c) => (
                  <Badge tone={c.catalog === "mabar" ? "purple" : "blue"}>
                    {c.catalog === "mabar" ? 'מב"ר' : "הילסון"}
                  </Badge>
                ),
              },
              {
                key: "domain",
                header: "תחום / תת-תחום",
                render: (c) => (
                  <span className="text-slate-600 text-xs">
                    {skillDomains.find((d) => d.id === c.skill_domain_id)?.name_he} ·{" "}
                    {skillSubdomains.find((sd) => sd.id === c.skill_subdomain_id)?.name_he}
                  </span>
                ),
              },
              {
                key: "type",
                header: "סוג פריט",
                render: (c) => <Badge tone="slate">{SERVICE_TYPE_LABELS[c.service_type]}</Badge>,
              },
              {
                key: "price",
                header: "מחיר",
                sortable: true,
                sortValue: (c) => c.base_price,
                render: (c) => (
                  <div>
                    <span className="font-medium text-slate-800">₪{c.base_price}</span>
                    <p className="text-[10px] text-slate-400">
                      {c.catalog === "mabar" ? "S — מחירון משה\"ב" : "P — מחיר מלא"}
                    </p>
                  </div>
                ),
              },
              {
                key: "referral",
                header: "הפניה",
                render: (c) => (c.requires_referral ? <Badge tone="amber">דורש הפניה</Badge> : <span className="text-slate-300">—</span>),
              },
              {
                key: "status",
                header: "סטטוס",
                render: (c) => (c.is_active ? <Badge tone="green">פעיל</Badge> : <Badge tone="slate">מושבת</Badge>),
              },
            ] satisfies DataTableColumn<CatalogItem>[]
          }
          rowActions={(c) => (
            <>
              <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        />
      </CardContent>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "עריכת פריט קטלוג" : "פריט קטלוג חדש"}
        className="max-w-2xl"
      >
        <CatalogItemForm
          key={editing?.id ?? "new"}
          skillDomains={skillDomains}
          skillSubdomains={skillSubdomains}
          providers={providers}
          initial={editing ? formFromItem(editing) : undefined}
          onSubmit={handleSubmit}
        />
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת פריט קטלוג"
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) {
            deleteCatalogItem(deleteId);
            showToast("פריט הקטלוג נמחק", { variant: "success" });
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title="מחיקת פריטים נבחרים"
        description={`${selectedIds.size} פריטי קטלוג יימחקו לצמיתות.`}
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          bulkDeleteCatalogItems([...selectedIds]);
          showToast(`${selectedIds.size} פריטים נמחקו`, { variant: "success" });
          setSelectedIds(new Set());
          setBulkDeleteOpen(false);
        }}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Catalog requests tab — Ops triage queue for provider-submitted "add this
// Healson item" requests. Approve → create item (reuses CatalogItemForm),
// merge into an existing item, ask for more info, or reject.
// ---------------------------------------------------------------------------
const REQUEST_STATUS_TONE: Record<CatalogRequestStatus, "warning" | "blue" | "green" | "danger" | "purple"> = {
  pending: "warning",
  needs_info: "blue",
  approved: "green",
  rejected: "danger",
  merged: "purple",
};

// A provider's guessed 7-way service type mapped to the admin catalog's 5-way
// ServiceType, so the approve form arrives sensibly pre-filled.
const PROVIDER_TO_CATALOG_SERVICE: Record<ProviderServiceType, ServiceType> = {
  consultation: "consultation",
  treatment: "treatment",
  surgery: "surgery",
  procedure: "treatment",
  imaging: "diagnostics",
  test: "diagnostics",
  product: "extra",
};

function requestToFormInitial(
  req: CatalogRequest,
  skillDomains: SkillDomain[],
  skillSubdomains: SkillSubdomain[]
): ItemFormValues {
  return {
    ...makeEmptyForm(skillDomains, skillSubdomains, "healson"),
    name_he: req.requested_name,
    service_type: req.service_type ? PROVIDER_TO_CATALOG_SERVICE[req.service_type] : "consultation",
  };
}

function CatalogRequestsManager() {
  const catalogRequests = useStore((s) => s.catalogRequests);
  const providers = useStore((s) => s.providers);
  const catalog = useStore((s) => s.catalog);
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const approveCatalogRequestAsItem = useStore((s) => s.approveCatalogRequestAsItem);
  const mergeCatalogRequest = useStore((s) => s.mergeCatalogRequest);
  const rejectCatalogRequest = useStore((s) => s.rejectCatalogRequest);
  const requestCatalogRequestInfo = useStore((s) => s.requestCatalogRequestInfo);
  const showToast = useStore((s) => s.showToast);

  const [statusFilter, setStatusFilter] = useState<CatalogRequestStatus | "open" | "">("open");
  const [approveTarget, setApproveTarget] = useState<CatalogRequest | null>(null);
  const [mergeTarget, setMergeTarget] = useState<CatalogRequest | null>(null);
  const [mergeQuery, setMergeQuery] = useState("");
  const [noteTarget, setNoteTarget] = useState<{ req: CatalogRequest; mode: "reject" | "needs_info" } | null>(null);
  const [note, setNote] = useState("");

  const providerName = (id: string) => {
    const p = providers.find((pr) => pr.id === id);
    return p ? `${p.title ?? ""} ${p.display_name}`.trim() : "ספק לא ידוע";
  };

  const filtered = useMemo(
    () =>
      catalogRequests.filter((r) => {
        if (statusFilter === "open") return r.status === "pending" || r.status === "needs_info";
        if (statusFilter === "") return true;
        return r.status === statusFilter;
      }),
    [catalogRequests, statusFilter]
  );

  const mergeCandidates = useMemo(() => {
    const q = mergeQuery.trim().toLowerCase();
    return catalog
      .filter((c) => c.catalog === "healson")
      .filter(
        (c) =>
          !q ||
          c.name_he.toLowerCase().includes(q) ||
          (c.tavar_code ?? "").toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [catalog, mergeQuery]);

  const isOpen = (r: CatalogRequest) => r.status === "pending" || r.status === "needs_info";

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row flex-wrap gap-2">
        <div>
          <CardTitle>בקשות להוספת פריטים לקטלוג</CardTitle>
          <p className="mt-0.5 text-xs text-slate-500">
            בקשות שהגישו נותני שירות לפריטים שחסרים בקטלוג הילסון
          </p>
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CatalogRequestStatus | "open" | "")}
          className="max-w-[200px]"
        >
          <option value="open">פתוחות (לטיפול)</option>
          <option value="">כל הבקשות</option>
          {(Object.keys(CATALOG_REQUEST_STATUS_LABELS) as CatalogRequestStatus[]).map((s) => (
            <option key={s} value={s}>
              {CATALOG_REQUEST_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardContent>
        <DataTable<CatalogRequest>
          rows={filtered}
          rowKey={(r) => r.id}
          emptyIcon={<Inbox className="h-10 w-10" />}
          emptyTitle="אין בקשות קטלוג"
          columns={
            [
              {
                key: "provider",
                header: "ספק",
                render: (r) => {
                  const p = providers.find((pr) => pr.id === r.provider_id);
                  return (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p?.display_name || "?"} src={p?.image_url} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{providerName(r.provider_id)}</p>
                        <p className="text-xs text-slate-400">{p?.specialty || "—"}</p>
                      </div>
                    </div>
                  );
                },
              },
              {
                key: "item",
                header: "פריט מבוקש",
                render: (r) => (
                  <div className="max-w-xs">
                    <p className="font-medium text-slate-900">{r.requested_name}</p>
                    {r.service_type && (
                      <Badge tone="blue" className="mt-1">
                        {PROVIDER_SERVICE_TYPE_LABELS[r.service_type]}
                      </Badge>
                    )}
                    {r.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{r.description}</p>
                    )}
                  </div>
                ),
              },
              {
                key: "date",
                header: "התקבלה",
                sortable: true,
                sortValue: (r) => r.created_date,
                render: (r) => <span className="text-sm text-slate-600">{formatDateHe(r.created_date)}</span>,
              },
              {
                key: "status",
                header: "סטטוס",
                render: (r) => (
                  <div>
                    <Badge tone={REQUEST_STATUS_TONE[r.status]}>{CATALOG_REQUEST_STATUS_LABELS[r.status]}</Badge>
                    {r.admin_note && (r.status === "needs_info" || r.status === "rejected") && (
                      <p className="mt-1 max-w-[220px] text-xs text-slate-500">{r.admin_note}</p>
                    )}
                  </div>
                ),
              },
            ] satisfies DataTableColumn<CatalogRequest>[]
          }
          rowActions={(r) =>
            isOpen(r) ? (
              <>
                <Button size="sm" onClick={() => setApproveTarget(r)}>
                  <Check className="h-3.5 w-3.5" /> אשר וצור
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMergeQuery("");
                    setMergeTarget(r);
                  }}
                >
                  <GitMerge className="h-3.5 w-3.5" /> מזג
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNote("");
                    setNoteTarget({ req: r, mode: "needs_info" });
                  }}
                >
                  <MessageSquareText className="h-3.5 w-3.5" /> בקש השלמה
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNote("");
                    setNoteTarget({ req: r, mode: "reject" });
                  }}
                >
                  <Ban className="h-3.5 w-3.5" /> דחה
                </Button>
              </>
            ) : (
              <span className="text-xs text-slate-400">טופל</span>
            )
          }
        />
      </CardContent>

      {/* Approve → create Healson catalog item (reuses the shared item form) */}
      <Dialog
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="אישור בקשה — יצירת פריט בקטלוג הילסון"
        description={approveTarget ? `מבוקש: ${approveTarget.requested_name}` : undefined}
        className="max-w-2xl"
      >
        {approveTarget && (
          <CatalogItemForm
            key={approveTarget.id}
            skillDomains={skillDomains}
            skillSubdomains={skillSubdomains}
            providers={providers}
            lockCatalog="healson"
            initial={requestToFormInitial(approveTarget, skillDomains, skillSubdomains)}
            submitLabel="אשר וצור פריט"
            onSubmit={(values) => {
              approveCatalogRequestAsItem(approveTarget.id, values);
              showToast("הפריט נוצר בקטלוג הילסון והבקשה אושרה", { variant: "success" });
              setApproveTarget(null);
            }}
          />
        )}
      </Dialog>

      {/* Merge → fold the request into an existing item */}
      <Dialog
        open={!!mergeTarget}
        onClose={() => setMergeTarget(null)}
        title="מיזוג עם פריט קיים"
        description={mergeTarget ? `הבקשה "${mergeTarget.requested_name}" תסומן כמוזגה לפריט שתבחר` : undefined}
      >
        <div className="flex flex-col gap-3">
          <Input
            placeholder="חיפוש פריט בקטלוג הילסון (שם או קוד)..."
            icon={<Search className="h-4 w-4" />}
            value={mergeQuery}
            onChange={(e) => setMergeQuery(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            {mergeCandidates.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">לא נמצאו פריטים</p>
            ) : (
              mergeCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (mergeTarget) {
                      mergeCatalogRequest(mergeTarget.id, c.id);
                      showToast("הבקשה מוזגה לפריט הקיים", { variant: "success" });
                      setMergeTarget(null);
                    }
                  }}
                  className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-right text-sm last:border-b-0 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <Badge tone="slate">{c.tavar_code}</Badge>
                    <span className="text-slate-800">{c.name_he}</span>
                  </span>
                  <Badge tone="slate">{SERVICE_TYPE_LABELS[c.service_type]}</Badge>
                </button>
              ))
            )}
          </div>
        </div>
      </Dialog>

      {/* Reject / request-more-info note */}
      <Dialog
        open={!!noteTarget}
        onClose={() => setNoteTarget(null)}
        title={noteTarget?.mode === "reject" ? "דחיית בקשה" : "בקשת השלמת פרטים"}
        description={noteTarget ? `מבוקש: ${noteTarget.req.requested_name}` : undefined}
      >
        <div className="flex flex-col gap-3">
          <Textarea
            label={noteTarget?.mode === "reject" ? "סיבת הדחייה (תוצג לספק)" : "מה נדרש להשלים? (יוצג לספק)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
          />
          <Button
            variant={noteTarget?.mode === "reject" ? "destructive" : "primary"}
            disabled={note.trim().length < 3}
            onClick={() => {
              if (!noteTarget) return;
              if (noteTarget.mode === "reject") {
                rejectCatalogRequest(noteTarget.req.id, note.trim());
                showToast("הבקשה נדחתה", { variant: "success" });
              } else {
                requestCatalogRequestInfo(noteTarget.req.id, note.trim());
                showToast("נשלחה בקשת השלמה לספק", { variant: "success" });
              }
              setNoteTarget(null);
            }}
          >
            {noteTarget?.mode === "reject" ? "דחה בקשה" : "שלח בקשת השלמה"}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
