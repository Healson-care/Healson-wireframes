"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { BodyMap, OptionGrid, PriceCalculator, SelectableOption, StepIndicator } from "@/components/catalog/Wizard";
import { BodyRegionMeta } from "@/lib/medical-tree";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, PageHeader } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { CatalogItem, SERVICE_TYPES, SERVICE_TYPE_LABELS, ServiceType, SkillDomain, SkillSubdomain } from "@/types";
import { RotateCcw, Plus, Pencil, Trash2, LayoutGrid, Search } from "lucide-react";

export default function AdminCatalogPage() {
  return (
    <AppLayout>
      <PageHeader title="קטלוג שירותים" description="עיון בקטלוג לצורך הפניה וייעוץ למטופלים, וניהול הטקסונומיה הרפואית" />

      <Tabs defaultValue="browse">
        <TabsList className="mb-5 max-w-xs">
          <TabsTrigger value="browse" icon={<Search className="h-3.5 w-3.5" />}>עיון</TabsTrigger>
          <TabsTrigger value="manage" icon={<LayoutGrid className="h-3.5 w-3.5" />}>ניהול</TabsTrigger>
        </TabsList>
        <TabsContent value="browse">
          <BrowseWizard />
        </TabsContent>
        <TabsContent value="manage">
          <CatalogManager />
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
                <EmptyState title="לא נמצאו שירותים" action={<ResetButton onReset={handleReset} />} />
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
                            <p className="text-xs text-slate-400">{item.tavar_code}</p>
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
// Management tab — CRUD for Skill Domains / Sub-domains / Catalog items (ADM-03)
// ---------------------------------------------------------------------------
function CatalogManager() {
  return (
    <div className="flex flex-col gap-5">
      <DomainsManager />
      <SubdomainsManager />
      <ItemsManager />
    </div>
  );
}

function DomainsManager() {
  const skillDomains = useStore((s) => s.skillDomains);
  const addSkillDomain = useStore((s) => s.addSkillDomain);
  const updateSkillDomain = useStore((s) => s.updateSkillDomain);
  const deleteSkillDomain = useStore((s) => s.deleteSkillDomain);
  const showToast = useStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SkillDomain | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_he: "", emoji: "", slug: "" });

  function openCreate() {
    setEditing(null);
    setForm({ name_he: "", emoji: "", slug: "" });
    setOpen(true);
  }
  function openEdit(d: SkillDomain) {
    setEditing(d);
    setForm({ name_he: d.name_he, emoji: d.emoji ?? "", slug: d.slug });
    setOpen(true);
  }
  function handleSave() {
    if (editing) {
      updateSkillDomain(editing.id, form);
      showToast("התחום עודכן", { variant: "success" });
    } else {
      addSkillDomain(form);
      showToast("תחום חדש נוסף", { variant: "success" });
    }
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle>תחומים רפואיים (Domains)</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> תחום חדש
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable<SkillDomain>
          rows={skillDomains}
          rowKey={(d) => d.id}
          emptyTitle="אין תחומים מוגדרים"
          columns={
            [
              { key: "emoji", header: "", render: (d) => <span className="text-lg">{d.emoji}</span> },
              { key: "name", header: "שם", render: (d) => <span className="font-medium text-slate-900">{d.name_he}</span> },
              { key: "slug", header: "מזהה", render: (d) => <span className="text-xs text-slate-400 font-mono">{d.slug}</span> },
            ] satisfies DataTableColumn<SkillDomain>[]
          }
          rowActions={(d) => (
            <>
              <button onClick={() => openEdit(d)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleteId(d.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        />
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "עריכת תחום" : "תחום חדש"}>
        <div className="flex flex-col gap-3">
          <Input label="שם התחום" value={form.name_he} onChange={(e) => setForm({ ...form, name_he: e.target.value })} required />
          <Input label="אימוג'י" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
          <Input label="מזהה (slug)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
          <Button onClick={handleSave}>שמור</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת תחום"
        description="כל תתי-התחומים המשויכים יימחקו גם הם."
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) {
            deleteSkillDomain(deleteId);
            showToast("התחום נמחק", { variant: "success" });
          }
        }}
      />
    </Card>
  );
}

function SubdomainsManager() {
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const addSkillSubdomain = useStore((s) => s.addSkillSubdomain);
  const updateSkillSubdomain = useStore((s) => s.updateSkillSubdomain);
  const deleteSkillSubdomain = useStore((s) => s.deleteSkillSubdomain);
  const showToast = useStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SkillSubdomain | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_he: "", slug: "", domain_id: skillDomains[0]?.id ?? "" });

  function openCreate() {
    setEditing(null);
    setForm({ name_he: "", slug: "", domain_id: skillDomains[0]?.id ?? "" });
    setOpen(true);
  }
  function openEdit(sd: SkillSubdomain) {
    setEditing(sd);
    setForm({ name_he: sd.name_he, slug: sd.slug, domain_id: sd.domain_id });
    setOpen(true);
  }
  function handleSave() {
    if (editing) {
      updateSkillSubdomain(editing.id, form);
      showToast("תת-התחום עודכן", { variant: "success" });
    } else {
      addSkillSubdomain(form);
      showToast("תת-תחום חדש נוסף", { variant: "success" });
    }
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle>תתי-תחומים (Sub-domains)</CardTitle>
        <Button size="sm" onClick={openCreate} disabled={skillDomains.length === 0}>
          <Plus className="h-4 w-4" /> תת-תחום חדש
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable<SkillSubdomain>
          rows={skillSubdomains}
          rowKey={(sd) => sd.id}
          emptyTitle="אין תתי-תחומים מוגדרים"
          columns={
            [
              { key: "name", header: "שם", render: (sd) => <span className="font-medium text-slate-900">{sd.name_he}</span> },
              {
                key: "domain",
                header: "תחום",
                render: (sd) => (
                  <span className="text-slate-600">{skillDomains.find((d) => d.id === sd.domain_id)?.name_he ?? "—"}</span>
                ),
              },
              { key: "slug", header: "מזהה", render: (sd) => <span className="text-xs text-slate-400 font-mono">{sd.slug}</span> },
            ] satisfies DataTableColumn<SkillSubdomain>[]
          }
          rowActions={(sd) => (
            <>
              <button onClick={() => openEdit(sd)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleteId(sd.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        />
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "עריכת תת-תחום" : "תת-תחום חדש"}>
        <div className="flex flex-col gap-3">
          <Select label="תחום" value={form.domain_id} onChange={(e) => setForm({ ...form, domain_id: e.target.value })} required>
            {skillDomains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_he}
              </option>
            ))}
          </Select>
          <Input label="שם תת-התחום" value={form.name_he} onChange={(e) => setForm({ ...form, name_he: e.target.value })} required />
          <Input label="מזהה (slug)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
          <Button onClick={handleSave}>שמור</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת תת-תחום"
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) {
            deleteSkillSubdomain(deleteId);
            showToast("תת-התחום נמחק", { variant: "success" });
          }
        }}
      />
    </Card>
  );
}

interface ItemFormValues {
  name_he: string;
  tavar_code: string;
  skill_domain_id: string;
  skill_subdomain_id: string;
  service_type: ServiceType;
  base_price: string;
  typical_duration_min: string;
  requires_referral: boolean;
  provider_id: string;
  is_active: boolean;
}

function ItemsManager() {
  const catalog = useStore((s) => s.catalog);
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const providers = useStore((s) => s.providers);
  const addCatalogItem = useStore((s) => s.addCatalogItem);
  const updateCatalogItem = useStore((s) => s.updateCatalogItem);
  const deleteCatalogItem = useStore((s) => s.deleteCatalogItem);
  const showToast = useStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = (): ItemFormValues => ({
    name_he: "",
    tavar_code: "",
    skill_domain_id: skillDomains[0]?.id ?? "",
    skill_subdomain_id: skillSubdomains.find((sd) => sd.domain_id === skillDomains[0]?.id)?.id ?? "",
    service_type: "consultation",
    base_price: "",
    typical_duration_min: "",
    requires_referral: false,
    provider_id: "",
    is_active: true,
  });
  const [form, setForm] = useState<ItemFormValues>(emptyForm());

  const filtered = useMemo(
    () => (query ? catalog.filter((c) => c.name_he.includes(query) || (c.tavar_code ?? "").includes(query)) : catalog),
    [catalog, query]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }
  function openEdit(item: CatalogItem) {
    setEditing(item);
    setForm({
      name_he: item.name_he,
      tavar_code: item.tavar_code ?? "",
      skill_domain_id: item.skill_domain_id,
      skill_subdomain_id: item.skill_subdomain_id,
      service_type: item.service_type,
      base_price: String(item.base_price),
      typical_duration_min: item.typical_duration_min ? String(item.typical_duration_min) : "",
      requires_referral: item.requires_referral,
      provider_id: item.provider_id ?? "",
      is_active: item.is_active,
    });
    setOpen(true);
  }

  function handleSave() {
    const values = {
      name_he: form.name_he,
      tavar_code: form.tavar_code || undefined,
      skill_domain_id: form.skill_domain_id,
      skill_subdomain_id: form.skill_subdomain_id,
      service_type: form.service_type,
      base_price: Number(form.base_price) || 0,
      typical_duration_min: form.typical_duration_min ? Number(form.typical_duration_min) : undefined,
      requires_referral: form.requires_referral,
      provider_id: form.provider_id || undefined,
      is_active: form.is_active,
    };
    if (editing) {
      updateCatalogItem(editing.id, values);
      showToast("פריט הקטלוג עודכן", { variant: "success" });
    } else {
      addCatalogItem(values);
      showToast("פריט קטלוג חדש נוסף", { variant: "success" });
    }
    setOpen(false);
  }

  const subdomainOptionsForForm = skillSubdomains.filter((sd) => sd.domain_id === form.skill_domain_id);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row flex-wrap gap-2">
        <CardTitle>פריטי קטלוג (Items)</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            placeholder="חיפוש לפי שם או קוד תב״ר..."
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
        <DataTable<CatalogItem>
          rows={filtered}
          rowKey={(c) => c.id}
          emptyIcon={<LayoutGrid className="h-10 w-10" />}
          emptyTitle="אין פריטי קטלוג"
          columns={
            [
              {
                key: "name",
                header: "שם השירות",
                render: (c) => (
                  <div>
                    <p className="font-medium text-slate-900">{c.name_he}</p>
                    <p className="text-xs text-slate-400">{c.tavar_code}</p>
                  </div>
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
                header: "סוג שירות",
                render: (c) => <Badge tone="slate">{SERVICE_TYPE_LABELS[c.service_type]}</Badge>,
              },
              {
                key: "price",
                header: "מחיר תב״ר",
                sortable: true,
                sortValue: (c) => c.base_price,
                render: (c) => <span className="font-medium text-slate-800">₪{c.base_price}</span>,
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

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "עריכת פריט קטלוג" : "פריט קטלוג חדש"} className="max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            label="שם השירות"
            className="sm:col-span-2"
            value={form.name_he}
            onChange={(e) => setForm({ ...form, name_he: e.target.value })}
            required
          />
          <Input label="קוד תב״ר" value={form.tavar_code} onChange={(e) => setForm({ ...form, tavar_code: e.target.value })} />
          <Select
            label="סוג שירות"
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
              setForm({ ...form, skill_domain_id: domain_id, skill_subdomain_id: skillSubdomains.find((sd) => sd.domain_id === domain_id)?.id ?? "" });
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
          <Input
            label="מחיר תב״ר בסיסי (₪)"
            type="number"
            value={form.base_price}
            onChange={(e) => setForm({ ...form, base_price: e.target.value })}
            required
          />
          <Input
            label="משך טיפול ממוצע (דקות)"
            type="number"
            value={form.typical_duration_min}
            onChange={(e) => setForm({ ...form, typical_duration_min: e.target.value })}
          />
          <Select label="ספק (אופציונלי)" value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
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
          <Button onClick={handleSave} className="sm:col-span-2 mt-1">
            שמור
          </Button>
        </div>
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
    </Card>
  );
}
