"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { useStore } from "@/lib/store";
import { formatCurrency, generateId } from "@/lib/utils";
import { LayerPriceInputs, emptyLayerPrices } from "@/components/provider/PriceListSection";
import { MohCodePicker } from "@/components/provider/MohCodePicker";
import { OpenDecisionNote } from "@/components/ui/Misc";
import { findMohCode, requiresMohCode } from "@/lib/moh-codes";
import {
  ANESTHESIA_TYPE_LABELS,
  ANESTHESIA_TYPES,
  AnesthesiaType,
  ConsultationType,
  INSURANCE_LAYERS,
  InsuranceLayer,
  LAYER_LABELS,
  PROVIDER_SERVICE_TYPE_LABELS,
  PROVIDER_SERVICE_TYPES,
  ProviderServiceType,
  ProviderType,
  getProviderServiceCategories,
  isUnitProviderType,
} from "@/types";
import { Plus, Pencil, Trash2, Stethoscope, MapPin, MonitorCog } from "lucide-react";

/** Provider-side catalog editor for medical-service provider types (§PRV-02)
 * — the provider picks services from the admin-managed Skill Tree
 * (domain -> sub-domain -> catalog item) instead of typing a name freely,
 * then sets their own S/K/B/H prices for the item. */
export function ServiceCatalogSection({
  items,
  onChange,
  providerId,
  itemLabel,
  providerSpecialty,
  providerType,
}: {
  items: ConsultationType[];
  onChange: (items: ConsultationType[]) => void;
  providerId: string;
  itemLabel: string;
  // Doctor's own specialty (ProviderProfile.specialty) — when it matches a
  // skill domain name_he (see medical-tree.ts), the picker below defaults to
  // and stays scoped to that one domain instead of showing all of them.
  providerSpecialty?: string;
  // Organization types (מרפאת חוץ / מכון רפואי) classify their catalog with
  // their own service vocabulary rather than the generic 7 service types —
  // the same list the applicant picked from during registration.
  providerType?: ProviderType;
}) {
  const serviceCategories = getProviderServiceCategories(providerType);
  // A medical unit has a single site, so a service isn't linked to a location —
  // it's linked to the resource that performs it (§PRV-08).
  const isUnit = isUnitProviderType(providerType);
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const catalog = useStore((s) => s.catalog);

  const matchedDomain = useMemo(
    () => (providerSpecialty ? skillDomains.find((d) => d.name_he === providerSpecialty) : undefined),
    [skillDomains, providerSpecialty]
  );

  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [domainId, setDomainId] = useState("");
  const [subdomainId, setSubdomainId] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [duration, setDuration] = useState("30");
  const [prices, setPrices] = useState<Record<InsuranceLayer, string>>(emptyLayerPrices());
  const [serviceType, setServiceType] = useState<ProviderServiceType>("consultation");
  const [serviceCategory, setServiceCategory] = useState<string>("");
  const [showAllDomains, setShowAllDomains] = useState(!matchedDomain);
  const [requiresReferral, setRequiresReferral] = useState(false);
  const [requiresFasting, setRequiresFasting] = useState(false);
  const [sampleType, setSampleType] = useState("");
  const [anesthesiaType, setAnesthesiaType] = useState<AnesthesiaType>("local");
  const [recoveryDays, setRecoveryDays] = useState("");
  const [requiresHospital, setRequiresHospital] = useState(false);
  const [requiresContrast, setRequiresContrast] = useState(false);
  const [hasRadiation, setHasRadiation] = useState(false);
  const [mohCode, setMohCode] = useState<string | undefined>(undefined);

  const availableCatalog = useMemo(
    () => catalog.filter((c) => c.is_active && (c.provider_id == null || c.provider_id === providerId)),
    [catalog, providerId]
  );

  const addedItemIds = useMemo(() => new Set(items.map((i) => i.catalog_item_id).filter(Boolean)), [items]);

  const domainOptions = matchedDomain && !showAllDomains ? [matchedDomain] : skillDomains;
  const subdomainOptions = skillSubdomains.filter((sd) => sd.domain_id === domainId);
  const itemOptions = availableCatalog.filter(
    (c) => c.skill_domain_id === domainId && c.skill_subdomain_id === subdomainId && (!addedItemIds.has(c.id) || c.id === catalogItemId)
  );
  const selectedCatalogItem = availableCatalog.find((c) => c.id === catalogItemId);

  function openCreate() {
    setEditingId(null);
    setDomainId(matchedDomain?.id ?? skillDomains[0]?.id ?? "");
    setSubdomainId("");
    setCatalogItemId("");
    setDuration("30");
    setPrices(emptyLayerPrices());
    setServiceType("consultation");
    setServiceCategory(serviceCategories?.[0] ?? "");
    setShowAllDomains(!matchedDomain);
    setRequiresReferral(false);
    setRequiresFasting(false);
    setSampleType("");
    setAnesthesiaType("local");
    setRecoveryDays("");
    setRequiresHospital(false);
    setRequiresContrast(false);
    setHasRadiation(false);
    setMohCode(undefined);
    setOpen(true);
  }

  function openEdit(item: ConsultationType) {
    setEditingId(item.id);
    const catalogItem = availableCatalog.find((c) => c.id === item.catalog_item_id);
    const itemDomainId = catalogItem?.skill_domain_id ?? "";
    setDomainId(itemDomainId);
    setSubdomainId(catalogItem?.skill_subdomain_id ?? "");
    setCatalogItemId(catalogItem?.id ?? "");
    setDuration(String(item.duration_minutes));
    const map = emptyLayerPrices();
    item.prices.forEach((p) => (map[p.layer] = String(p.price)));
    setPrices(map);
    setServiceType(item.service_type ?? "consultation");
    setServiceCategory(item.service_category ?? serviceCategories?.[0] ?? "");
    setShowAllDomains(!matchedDomain || itemDomainId !== matchedDomain.id);
    setRequiresReferral(item.requires_referral ?? false);
    setRequiresFasting(item.requires_fasting ?? false);
    setSampleType(item.sample_type ?? "");
    setAnesthesiaType(item.anesthesia_type ?? "local");
    setRecoveryDays(item.recovery_days != null ? String(item.recovery_days) : "");
    setRequiresHospital(item.requires_hospital ?? false);
    setRequiresContrast(item.requires_contrast ?? false);
    setHasRadiation(item.has_radiation ?? false);
    setMohCode(item.moh_code);
    setOpen(true);
  }

  function handleSave() {
    const catalogItem = availableCatalog.find((c) => c.id === catalogItemId);
    const editingExisting = editingId ? items.find((i) => i.id === editingId) : undefined;
    const newItem: ConsultationType = {
      id: editingId ?? generateId("item"),
      name: catalogItem?.name_he ?? editingExisting?.name ?? "",
      duration_minutes: Number(duration) || 30,
      prices: INSURANCE_LAYERS.filter((l) => prices[l] !== "").map((l) => ({ layer: l, price: Number(prices[l]) || 0 })),
      catalog_item_id: catalogItem?.id ?? editingExisting?.catalog_item_id,
      service_type: serviceType,
      service_category: serviceCategories ? serviceCategory || undefined : editingExisting?.service_category,
      // Only the coded clinical types carry a MOH code — switching an item to
      // "ייעוץ" must not leave a stale imaging code behind.
      moh_code: requiresMohCode(serviceType) ? mohCode : undefined,
      // Location linking is owned by the clinics screen now — preserve whatever
      // links already exist, never reset them from here.
      linked_clinic_ids: editingExisting?.linked_clinic_ids ?? [],
      requires_referral: requiresReferral,
      requires_fasting: serviceType === "test" ? requiresFasting : undefined,
      sample_type: serviceType === "test" && sampleType ? sampleType : undefined,
      anesthesia_type: serviceType === "surgery" ? anesthesiaType : undefined,
      recovery_days: serviceType === "surgery" && recoveryDays ? Number(recoveryDays) : undefined,
      requires_hospital: serviceType === "surgery" ? requiresHospital : undefined,
      requires_contrast: serviceType === "imaging" ? requiresContrast : undefined,
      has_radiation: serviceType === "imaging" ? hasRadiation : undefined,
    };
    if (editingId) {
      onChange(items.map((i) => (i.id === editingId ? newItem : i)));
    } else {
      onChange([...items, newItem]);
    }
    setOpen(false);
  }

  function domainName(id: string) {
    return skillDomains.find((d) => d.id === id)?.name_he ?? "";
  }
  function subdomainName(id: string) {
    return skillSubdomains.find((d) => d.id === id)?.name_he ?? "";
  }

  const needsMohCode = requiresMohCode(serviceType);
  const canSave =
    (editingId ? true : !!catalogItemId) &&
    (!serviceCategories || !!serviceCategory) &&
    (!needsMohCode || !!mohCode);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> הוסף {itemLabel} מה-Skill Tree
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Stethoscope className="h-10 w-10" />} title={`אין ${itemLabel} מוגדרים`} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const catalogItem = availableCatalog.find((c) => c.id === item.catalog_item_id);
            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {catalogItem && (
                        <Badge tone="slate">
                          {domainName(catalogItem.skill_domain_id)} · {subdomainName(catalogItem.skill_subdomain_id)}
                        </Badge>
                      )}
                      {item.service_category ? (
                        <Badge tone="blue">{item.service_category}</Badge>
                      ) : (
                        item.service_type && <Badge tone="blue">{PROVIDER_SERVICE_TYPE_LABELS[item.service_type]}</Badge>
                      )}
                      <span className="text-xs text-slate-500">{item.duration_minutes} דק׳</span>
                    </div>
                    {item.moh_code && (
                      <p className="mt-1 text-[11px] text-slate-500" title={findMohCode(item.moh_code)?.name_he}>
                        קוד משרד הבריאות: <span className="font-medium text-slate-700">{item.moh_code}</span>
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {item.requires_referral && <Badge tone="amber">דורש הפניה</Badge>}
                      {item.requires_fasting && <Badge tone="amber">דורש צום</Badge>}
                      {item.anesthesia_type && <Badge tone="purple">הרדמה {ANESTHESIA_TYPE_LABELS[item.anesthesia_type]}</Badge>}
                      {item.requires_hospital && <Badge tone="purple">מצריך אשפוז</Badge>}
                      {item.requires_contrast && <Badge tone="purple">חומר ניגוד</Badge>}
                      {item.has_radiation && <Badge tone="purple">קרינה מייננת</Badge>}
                    </div>
                    <div className="mt-1.5">
                      {isUnit ? (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <MonitorCog className="h-3 w-3" /> שייכו למתקן או לרופא/ה כדי לפתוח תורים
                        </span>
                      ) : (item.linked_clinic_ids?.length ?? 0) > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="h-3 w-3" />
                          מוצע ב-{item.linked_clinic_ids!.length} מיקומים
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <MapPin className="h-3 w-3" /> שייכו למיקום בלשונית &quot;מרפאות&quot;
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                  {item.prices.map((p) => (
                    <div key={p.layer} className="flex justify-between rounded-md bg-slate-50 px-2 py-1">
                      <span className="text-slate-500">{LAYER_LABELS[p.layer]}</span>
                      <span className="font-medium text-slate-700">{formatCurrency(p.price)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={editingId ? `עריכת ${itemLabel}` : `${itemLabel} חדש`} className="max-w-xl">
        <div className="flex flex-col gap-3">
          {editingId && !selectedCatalogItem ? (
            <p className="text-sm text-slate-500 rounded-lg bg-slate-50 px-3 py-2">{items.find((i) => i.id === editingId)?.name}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {matchedDomain && !showAllDomains && (
                <p className="sm:col-span-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    התחום מוצג לפי ההתמחות שלך: <strong className="text-slate-700">{matchedDomain.name_he}</strong>
                  </span>
                  <button type="button" onClick={() => setShowAllDomains(true)} className="shrink-0 font-medium text-primary hover:underline">
                    לא מוצא/ת את השירות? הצג את כל התחומים
                  </button>
                </p>
              )}
              <Select
                label="תחום"
                value={domainId}
                onChange={(e) => {
                  setDomainId(e.target.value);
                  setSubdomainId("");
                  setCatalogItemId("");
                }}
                disabled={!!matchedDomain && !showAllDomains}
              >
                <option value="">בחר תחום</option>
                {domainOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name_he}
                  </option>
                ))}
              </Select>
              <Select
                label="תת-תחום"
                value={subdomainId}
                onChange={(e) => {
                  setSubdomainId(e.target.value);
                  setCatalogItemId("");
                }}
                disabled={!domainId}
              >
                <option value="">בחר תת-תחום</option>
                {subdomainOptions.map((sd) => (
                  <option key={sd.id} value={sd.id}>
                    {sd.name_he}
                  </option>
                ))}
              </Select>
              <Select
                label="שירות"
                value={catalogItemId}
                onChange={(e) => {
                  setCatalogItemId(e.target.value);
                  const item = availableCatalog.find((c) => c.id === e.target.value);
                  if (item?.typical_duration_min) setDuration(String(item.typical_duration_min));
                }}
                disabled={!subdomainId}
                className="sm:col-span-2"
              >
                <option value="">בחר שירות</option>
                {itemOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_he}
                    {c.tavar_code ? ` (${c.tavar_code})` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {selectedCatalogItem && (
            <p className="text-xs text-slate-400">מחיר תב״ר ייחוס (משרד הבריאות): {formatCurrency(selectedCatalogItem.base_price)}</p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {/* Organization types classify by their own catalogue (§PRV-02);
                everyone else keeps the generic 7-way classification. */}
            {serviceCategories ? (
              <Select
                label="סוג השירות"
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
                required
              >
                <option value="">בחר/י סוג שירות</option>
                {serviceCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            ) : (
              <Select label="סוג שירות" value={serviceType} onChange={(e) => setServiceType(e.target.value as ProviderServiceType)}>
                {PROVIDER_SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROVIDER_SERVICE_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
            <Input label="משך (דקות)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </div>

          {/* The category above drives the patient-facing grouping; the
              clinical classification below still decides which prep fields
              (fasting, anesthesia, contrast…) are relevant. */}
          {serviceCategories && (
            <Select
              label="סיווג קליני (קובע אילו שדות הכנה נדרשים)"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ProviderServiceType)}
            >
              {PROVIDER_SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROVIDER_SERVICE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}

          {/* Ministry of Health code (§PRV-09) — mandatory for the clinical
              types that have one, absent for consultations/products. */}
          {needsMohCode ? (
            <MohCodePicker serviceType={serviceType} value={mohCode} onChange={setMohCode} />
          ) : (
            <OpenDecisionNote className="mb-0">
              <b>שאלה פתוחה:</b> ל{PROVIDER_SERVICE_TYPE_LABELS[serviceType]} אין קוד רשמי של משרד הבריאות. עדיין
              לא הוחלט איך מקודדים שירותים פנימיים כאלה — קוד פנימי של Healson, קוד שהספק מגדיר בעצמו, או ללא קוד
              כלל. עד להחלטה השירות נשמר לפי שמו מה-Skill Tree בלבד.
            </OpenDecisionNote>
          )}

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={requiresReferral}
                onChange={(e) => setRequiresReferral(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-primary"
              />
              נדרשת הפניה / אישור מראש מהקופה
            </label>

            {serviceType === "test" && (
              <>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresFasting}
                    onChange={(e) => setRequiresFasting(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  נדרש צום לפני הבדיקה
                </label>
                <Input label="סוג דגימה (לא חובה)" value={sampleType} onChange={(e) => setSampleType(e.target.value)} />
              </>
            )}

            {serviceType === "surgery" && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Select label="סוג הרדמה" value={anesthesiaType} onChange={(e) => setAnesthesiaType(e.target.value as AnesthesiaType)}>
                    {ANESTHESIA_TYPES.map((a) => (
                      <option key={a} value={a}>
                        {ANESTHESIA_TYPE_LABELS[a]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="ימי החלמה משוערים"
                    type="number"
                    value={recoveryDays}
                    onChange={(e) => setRecoveryDays(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresHospital}
                    onChange={(e) => setRequiresHospital(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  מצריך אשפוז בבית חולים
                </label>
              </>
            )}

            {serviceType === "imaging" && (
              <>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresContrast}
                    onChange={(e) => setRequiresContrast(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  נדרש חומר ניגוד
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasRadiation}
                    onChange={(e) => setHasRadiation(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  כרוך בקרינה מייננת
                </label>
              </>
            )}
          </div>

          <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {isUnit ? (
              <>
                <MonitorCog className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                ליחידה רפואית אין סניפים — היחידה עצמה היא הסניף. את השירות משייכים למתקן (MRI 1, CT 1) בלשונית
                &quot;מתקנים&quot;, או לרופא/ה בלשונית &quot;רופאים&quot; — שם גם נקבעת הזמינות שלו.
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                שיוך השירות למיקומים נעשה בלשונית &quot;מרפאות&quot; — שם בוחרים לכל מיקום אילו שירותים מוצעים בו.
              </>
            )}
          </p>

          <p className="text-xs text-slate-400">מחיר לשכבת ביטוח — השאירו ריק אם הספק לא עובד מול שכבה זו</p>
          <LayerPriceInputs prices={prices} onChange={setPrices} />
          <Button onClick={handleSave} disabled={!canSave}>
            שמור
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={`מחיקת ${itemLabel}`}
        description="פעולה זו אינה הפיכה."
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) onChange(items.filter((i) => i.id !== deleteId));
        }}
      />
    </div>
  );
}
