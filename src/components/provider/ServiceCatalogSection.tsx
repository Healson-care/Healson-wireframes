"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { useStore } from "@/lib/store";
import { formatCurrency, generateId } from "@/lib/utils";
import { defaultRequiresReferral, requiresReferral as requiresReferralOf } from "@/lib/referral";
import {
  ANESTHESIA_TYPE_LABELS,
  ANESTHESIA_TYPES,
  AnesthesiaType,
  CATALOG_CODE_LABELS,
  CATALOG_KIND_LABELS,
  CatalogItem,
  ConsultationType,
  InsuranceLayer,
  LAYER_LABELS,
  PROVIDER_SERVICE_TYPE_LABELS,
  PROVIDER_SERVICE_TYPES,
  PayerPrice,
  ProviderServiceType,
  ProviderType,
  canSellConsultations,
  catalogKindForProviderType,
  getProviderServiceCategories,
  isUnitProviderType,
  payerPriceLabel,
} from "@/types";
import { Plus, Pencil, Trash2, Stethoscope, MapPin, MonitorCog, Search, Lock } from "lucide-react";

/** A room (ProviderFacility) or an individual service provider
 * (AffiliatedDoctor) an item can be assigned to — passed in by the page so
 * this section can assign items directly at entry time (§PRV-08). */
export interface ResourceTarget {
  id: string;
  name: string;
  service_ids: string[];
  /** The מערך this עמדה belongs to — items are assigned at מערך level, and
   * only narrowed to individual עמדות when their לו״זים genuinely differ. */
  service_array_id?: string;
  kind: "facility" | "doctor";
  /** True when this עמדה has a לו״ז of its own (inline or shared). Shown so a
   * provider narrowing by schedule can tell which עמדות actually run. */
  hasSchedule?: boolean;
}

/** A מערך, as far as the item dialog is concerned. */
export interface ServiceArrayTarget {
  id: string;
  name: string;
  branchName?: string;
}

/** A read-only price, rendered with the same label + box geometry as <Input>
 * so locked MoH layers align with the editable ones in the same grid. */
function LockedPriceField({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
        <Lock className="h-3 w-3" /> {label}
      </span>
      <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
        {value != null ? formatCurrency(value) : "—"}
      </div>
    </div>
  );
}

function layerPrice(item: CatalogItem | undefined, layer: InsuranceLayer): number | undefined {
  return item?.layer_prices?.find((p) => p.layer === layer)?.price;
}

/** Per-payer prices behind the K/B headline tariffs (payments meeting §6).
 * Healson negotiates these with each קופה plan / carrier, so the provider reads
 * them — a co-pay under an הסדר, or "החזר ישירות מהמבטח" when the payer only
 * reimburses the patient and no money passes through the provider at all. */
function PayerPriceTable({ rows }: { rows: PayerPrice[] }) {
  const byLayer: { layer: "K" | "B"; title: string; items: PayerPrice[] }[] = [
    { layer: "K", title: `${LAYER_LABELS.K} — לפי קופה ורובד`, items: rows.filter((r) => r.layer === "K") },
    { layer: "B", title: `${LAYER_LABELS.B} — לפי מבטח`, items: rows.filter((r) => r.layer === "B") },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {byLayer
        .filter((g) => g.items.length > 0)
        .map((group) => (
          <div key={group.layer}>
            <p className="mb-1 text-[11px] font-medium text-slate-500">{group.title}</p>
            <div className="overflow-hidden rounded-md border border-slate-200">
              {group.items.map((row, i) => (
                <div
                  key={`${payerPriceLabel(row)}-${i}`}
                  className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-2.5 py-1.5 text-xs last:border-b-0"
                >
                  <span className="text-slate-700">{payerPriceLabel(row)}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={row.mode === "החזר" ? "slate" : "blue"}>{row.mode}</Badge>
                    <span className="min-w-16 text-left font-medium text-slate-800">
                      {row.price != null ? formatCurrency(row.price) : "החזר מהמבטח"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      <p className="text-[11px] text-slate-400">
        המחירים נקבעים מול המשלמים בקטלוג הילסון ואינם ניתנים לעריכה כאן. תחת &quot;הסדר&quot; הסכום המוצג הוא
        ההשתתפות העצמית שהמטופל משלם; תחת &quot;החזר&quot; המטופל משלם את המחיר המלא ומגיש תביעה למבטח בעצמו.
      </p>
    </div>
  );
}

/** Provider-side item entry (§PRV-02) — the provider enters items by code or
 * free-text search against the ONE reference catalog their provider type is
 * exposed to (קטלוג מב"ר for מכון/חדרי ניתוח/בית מרקחת, קטלוג הילסון for
 * individual providers and every other medical unit). S and H always mirror
 * the Ministry of Health price list and are locked; Healson items add a full
 * item price P plus editable K/B tariffs. */
export function ServiceCatalogSection({
  items,
  onChange,
  providerId,
  itemLabel,
  providerType,
  roomTargets,
  providerTargets,
  serviceArrayTargets,
  onAssignResources,
}: {
  items: ConsultationType[];
  onChange: (items: ConsultationType[]) => void;
  providerId: string;
  itemLabel: string;
  // Organization types (מרפאת חוץ / מכון רפואי) classify their catalog with
  // their own service vocabulary rather than the generic 7 service types —
  // the same list the applicant picked from during registration.
  providerType?: ProviderType;
  // Medical units only — the unit's rooms and affiliated service providers,
  // so an item is assigned to its resource at entry time.
  roomTargets?: ResourceTarget[];
  providerTargets?: ResourceTarget[];
  /** The unit's מערכים — the level an item is actually assigned at. */
  serviceArrayTargets?: ServiceArrayTarget[];
  onAssignResources?: (
    serviceId: string,
    selection: { roomIds: string[]; providerIds: string[]; serviceArrayIds: string[] }
  ) => void;
}) {
  const serviceCategories = getProviderServiceCategories(providerType);
  // A medical unit has a single site, so an item isn't linked to a location —
  // it's linked to the resource (room / provider) that performs it (§PRV-08).
  const isUnit = isUnitProviderType(providerType);
  const catalogKind = catalogKindForProviderType(providerType);
  // A מכון sells examinations and procedures, never consultations (payments
  // meeting §6/§9) — so the reference-catalog search hides consultation items
  // entirely and the clinical classification below drops that option.
  const allowsConsultations = canSellConsultations(providerType);
  const clinicalTypes = allowsConsultations
    ? PROVIDER_SERVICE_TYPES
    : PROVIDER_SERVICE_TYPES.filter((t) => t !== "consultation");
  const defaultServiceType: ProviderServiceType = allowsConsultations ? "consultation" : "test";
  const catalog = useStore((s) => s.catalog);
  const catalogRequests = useStore((s) => s.catalogRequests);
  const addCatalogRequest = useStore((s) => s.addCatalogRequest);
  const showToast = useStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqType, setReqType] = useState<ProviderServiceType>(defaultServiceType);
  const [reqDesc, setReqDesc] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [duration, setDuration] = useState("30");
  const [priceFull, setPriceFull] = useState("");
  const [serviceType, setServiceType] = useState<ProviderServiceType>(defaultServiceType);
  const [serviceCategory, setServiceCategory] = useState<string>("");
  const [requiresReferral, setRequiresReferral] = useState(false);
  const [requiresFasting, setRequiresFasting] = useState(false);
  const [sampleType, setSampleType] = useState("");
  const [anesthesiaType, setAnesthesiaType] = useState<AnesthesiaType>("local");
  const [recoveryDays, setRecoveryDays] = useState("");
  const [requiresHospital, setRequiresHospital] = useState(false);
  const [requiresContrast, setRequiresContrast] = useState(false);
  const [hasRadiation, setHasRadiation] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  // An item belongs to a מערך. By default every עמדה in that מערך performs it;
  // `limitToStations` is the escape hatch for the real case where only some of
  // a מערך's לו״זים actually offer the item (e.g. only the 3T MRI does cardiac).
  const [selectedArrayIds, setSelectedArrayIds] = useState<string[]>([]);
  const [limitToStations, setLimitToStations] = useState(false);

  // Only the catalog this provider type is exposed to — a מכון never sees
  // Healson items and a מרפאת חוץ never sees מב"ר items.
  const eligibleCatalog = useMemo(
    () =>
      catalog.filter(
        (c) =>
          c.catalog === catalogKind &&
          c.is_active &&
          (allowsConsultations || c.service_type !== "consultation") &&
          (c.provider_id == null || c.provider_id === providerId)
      ),
    [catalog, catalogKind, providerId, allowsConsultations]
  );

  const addedItemIds = useMemo(
    () => new Set(items.map((i) => i.catalog_item_id).filter(Boolean)),
    [items]
  );

  // A unit can carry dozens or hundreds of items — a free-text filter over
  // name/code/category keeps the grid manageable instead of an endless scroll.
  const [listFilter, setListFilter] = useState("");
  const visibleItems = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const catalogItem = catalog.find((c) => c.id === item.catalog_item_id);
      const code = catalogItem?.tavar_code ?? item.moh_code ?? "";
      return (
        item.name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        (item.service_category ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, catalog, listFilter]);

  // This provider's still-open catalog requests (Healson catalog only) — shown
  // so they don't re-request the same missing item while Ops is triaging it.
  const myOpenRequests = useMemo(
    () =>
      catalogRequests.filter(
        (r) => r.provider_id === providerId && (r.status === "pending" || r.status === "needs_info")
      ),
    [catalogRequests, providerId]
  );

  function openRequest() {
    setReqName(query.trim());
    setReqType(serviceType);
    setReqDesc("");
    setOpen(false);
    setRequestOpen(true);
  }

  function submitRequest() {
    addCatalogRequest({
      provider_id: providerId,
      requested_name: reqName.trim(),
      service_type: reqType,
      description: reqDesc.trim() || undefined,
      catalog_kind: "healson",
    });
    showToast("הבקשה נשלחה לצוות הילסון — נעדכן אותך כשהפריט יתווסף", { variant: "success" });
    setRequestOpen(false);
  }

  // Code or free-text search: "54021" matches by code, "MRI" completes every
  // item whose name contains MRI, alongside its code.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return eligibleCatalog
      .filter((c) => !addedItemIds.has(c.id) || c.id === catalogItemId)
      .filter(
        (c) =>
          (c.tavar_code ?? "").toLowerCase().includes(q) ||
          c.name_he.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [eligibleCatalog, addedItemIds, catalogItemId, query]);

  const selectedCatalogItem = eligibleCatalog.find((c) => c.id === catalogItemId);
  const mohS = layerPrice(selectedCatalogItem, "S");
  const mohH = layerPrice(selectedCatalogItem, "H");
  // Healson's negotiated payer tariffs — read-only for the provider (§6).
  const tariffK = layerPrice(selectedCatalogItem, "K");
  const tariffB = layerPrice(selectedCatalogItem, "B");
  const payerRows = selectedCatalogItem?.payer_prices ?? [];

  function pickCatalogItem(item: CatalogItem) {
    setCatalogItemId(item.id);
    setQuery(`${item.tavar_code ?? ""} — ${item.name_he}`);
    if (item.typical_duration_min) setDuration(String(item.typical_duration_min));
    setRequiresReferral(item.requires_referral);
    if (catalogKind === "healson") {
      setPriceFull(item.price_full != null ? String(item.price_full) : String(item.base_price));
    }
  }

  function resetForm() {
    setQuery("");
    setCatalogItemId("");
    setDuration("30");
    setPriceFull("");
    setServiceType(defaultServiceType);
    setServiceCategory(serviceCategories?.[0] ?? "");
    setRequiresReferral(defaultRequiresReferral(defaultServiceType));
    setRequiresFasting(false);
    setSampleType("");
    setAnesthesiaType("local");
    setRecoveryDays("");
    setRequiresHospital(false);
    setRequiresContrast(false);
    setHasRadiation(false);
    setSelectedRoomIds([]);
    setSelectedProviderIds([]);
    setSelectedArrayIds([]);
    setLimitToStations(false);
  }

  function openCreate() {
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(item: ConsultationType) {
    setEditingId(item.id);
    resetForm();
    const catalogItem = eligibleCatalog.find((c) => c.id === item.catalog_item_id);
    setCatalogItemId(catalogItem?.id ?? "");
    setQuery(catalogItem ? `${catalogItem.tavar_code ?? ""} — ${catalogItem.name_he}` : item.name);
    setDuration(String(item.duration_minutes));
    setPriceFull(item.price_full != null ? String(item.price_full) : "");
    setServiceType(item.service_type ?? defaultServiceType);
    setServiceCategory(item.service_category ?? serviceCategories?.[0] ?? "");
    // Items saved before the flag was editable carry the old type rule — open
    // them on exactly what patients experience today, then let it change.
    setRequiresReferral(requiresReferralOf(item));
    setRequiresFasting(item.requires_fasting ?? false);
    setSampleType(item.sample_type ?? "");
    setAnesthesiaType(item.anesthesia_type ?? "local");
    setRecoveryDays(item.recovery_days != null ? String(item.recovery_days) : "");
    setRequiresHospital(item.requires_hospital ?? false);
    setRequiresContrast(item.requires_contrast ?? false);
    setHasRadiation(item.has_radiation ?? false);
    setSelectedRoomIds((roomTargets ?? []).filter((r) => r.service_ids.includes(item.id)).map((r) => r.id));
    setSelectedProviderIds(
      (providerTargets ?? []).filter((p) => p.service_ids.includes(item.id)).map((p) => p.id)
    );
    // Prefer the stored מערך link; fall back to deriving it from whichever
    // עמדות already perform the item, so pre-existing catalogs open correctly.
    const linkedStations = [...(roomTargets ?? []), ...(providerTargets ?? [])].filter((r) =>
      r.service_ids.includes(item.id)
    );
    const derivedArrayIds = [
      ...new Set(linkedStations.map((r) => r.service_array_id).filter((x): x is string => !!x)),
    ];
    const arrayIds = item.service_array_ids?.length ? item.service_array_ids : derivedArrayIds;
    setSelectedArrayIds(arrayIds);
    // Narrowed if the item runs on fewer עמדות than its מערכים contain.
    const allInArrays = [...(roomTargets ?? []), ...(providerTargets ?? [])].filter(
      (r) => r.service_array_id && arrayIds.includes(r.service_array_id)
    );
    setLimitToStations(
      item.limited_to_stations ?? (allInArrays.length > 0 && linkedStations.length < allInArrays.length)
    );
    setOpen(true);
  }

  function handleSave() {
    const catalogItem = eligibleCatalog.find((c) => c.id === catalogItemId);
    const editingExisting = editingId ? items.find((i) => i.id === editingId) : undefined;
    const id = editingId ?? generateId("item");
    const refItem = catalogItem ?? eligibleCatalog.find((c) => c.id === editingExisting?.catalog_item_id);

    // No layer price is provider-entered any more (payments meeting §6): S and
    // H mirror the Ministry of Health list, and K/B are the tariffs Healson
    // negotiated with the payers. All four are copied off the catalog item, so
    // the provider's price list can never drift from the reference catalog.
    // Older items entered before the reference catalogs existed carry no
    // catalog_item_id, so there is nothing to read prices off — those keep the
    // prices they already have rather than being blanked on an unrelated edit.
    const prices: ConsultationType["prices"] = [];
    for (const layer of ["S", "K", "B", "H"] as const) {
      const value =
        layerPrice(refItem, layer) ??
        editingExisting?.prices.find((p) => p.layer === layer)?.price;
      if (value != null) prices.push({ layer, price: value });
    }

    const newItem: ConsultationType = {
      id,
      name: refItem?.name_he ?? editingExisting?.name ?? "",
      duration_minutes: Number(duration) || 30,
      prices,
      price_full:
        catalogKind === "healson" && priceFull !== "" ? Number(priceFull) || 0 : undefined,
      catalog_item_id: refItem?.id ?? editingExisting?.catalog_item_id,
      service_type: serviceType,
      service_category: serviceCategories ? serviceCategory || undefined : editingExisting?.service_category,
      // The item's code always comes from the catalog it was entered from.
      // For מב"ר items that code IS the Ministry of Health code.
      moh_code: refItem?.catalog === "mabar" ? refItem.tavar_code : editingExisting?.moh_code,
      // Location linking is owned by the clinics screen — preserve whatever
      // links already exist, never reset them from here.
      linked_clinic_ids: editingExisting?.linked_clinic_ids ?? [],
      service_array_ids: isUnit ? selectedArrayIds : editingExisting?.service_array_ids,
      // Only meaningful when the item runs on a subset of its מערך's עמדות.
      limited_to_stations: isUnit ? limitToStations || undefined : editingExisting?.limited_to_stations,
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
    if (isUnit && onAssignResources) {
      // Not narrowed → every עמדה in the chosen מערכים performs the item, so
      // the מערך choice expands to its stations here rather than making the
      // provider tick each one.
      const inArrays = (list?: ResourceTarget[]) =>
        (list ?? []).filter((r) => r.service_array_id && selectedArrayIds.includes(r.service_array_id)).map((r) => r.id);
      onAssignResources(id, {
        roomIds: limitToStations ? selectedRoomIds : inArrays(roomTargets),
        providerIds: limitToStations ? selectedProviderIds : inArrays(providerTargets),
        serviceArrayIds: selectedArrayIds,
      });
    }
    setOpen(false);
  }

  // The עמדות that live in the currently-selected מערכים, grouped so the
  // narrowing picker reads as "within מערך X, these stations".
  const stationsInSelectedArrays = useMemo(() => {
    const all = [...(roomTargets ?? []), ...(providerTargets ?? [])];
    return selectedArrayIds
      .map((arrayId) => ({
        arrayId,
        arrayName: serviceArrayTargets?.find((a) => a.id === arrayId)?.name ?? "מערך",
        stations: all.filter((r) => r.service_array_id === arrayId),
      }))
      .filter((g) => g.stations.length > 0);
  }, [selectedArrayIds, roomTargets, providerTargets, serviceArrayTargets]);

  function toggleTarget(id: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function assignmentLabel(item: ConsultationType): string | null {
    if (!isUnit) return null;
    const names = [
      ...(roomTargets ?? []).filter((r) => r.service_ids.includes(item.id)).map((r) => r.name),
      ...(providerTargets ?? []).filter((p) => p.service_ids.includes(item.id)).map((p) => p.name),
    ];
    return names.length > 0 ? names.join(", ") : null;
  }

  const canSave =
    (editingId ? true : !!catalogItemId) &&
    (!serviceCategories || !!serviceCategory) &&
    (catalogKind !== "healson" || priceFull !== "");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          מקור הפריטים: <strong className="text-slate-700">{CATALOG_KIND_LABELS[catalogKind]}</strong>
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> הוספת {itemLabel} לפי קוד
        </Button>
      </div>

      {catalogKind === "healson" && myOpenRequests.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2 text-xs text-info-text">
          <Search className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            {myOpenRequests.length === 1
              ? "בקשה אחת להוספת פריט לקטלוג ממתינה לצוות הילסון: "
              : `${myOpenRequests.length} בקשות להוספת פריטים לקטלוג ממתינות לצוות הילסון: `}
            {myOpenRequests.map((r) => r.requested_name).join(" · ")}
          </span>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-3">
          <Input
            icon={<Search className="h-4 w-4" />}
            placeholder={`חיפוש לפי שם, קוד או קטגוריה (${items.length} ${itemLabel}ים)`}
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<Stethoscope className="h-10 w-10" />} title={`אין ${itemLabel}ים מוגדרים`} />
      ) : visibleItems.length === 0 ? (
        <EmptyState icon={<Search className="h-10 w-10" />} title="לא נמצאו פריטים תואמים" description="נסו מונח חיפוש אחר." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {visibleItems.map((item) => {
            const catalogItem = catalog.find((c) => c.id === item.catalog_item_id);
            const code = catalogItem?.tavar_code ?? item.moh_code;
            const assigned = assignmentLabel(item);
            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {code && (
                        <Badge tone="slate">
                          {catalogItem ? CATALOG_CODE_LABELS[catalogItem.catalog] : "קוד"}: {code}
                        </Badge>
                      )}
                      {item.service_category ? (
                        <Badge tone="blue">{item.service_category}</Badge>
                      ) : (
                        item.service_type && <Badge tone="blue">{PROVIDER_SERVICE_TYPE_LABELS[item.service_type]}</Badge>
                      )}
                      <span className="text-xs text-slate-500">{item.duration_minutes} דק׳</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {requiresReferralOf(item) && <Badge tone="amber">דורש הפניה</Badge>}
                      {item.requires_fasting && <Badge tone="amber">דורש צום</Badge>}
                      {item.anesthesia_type && <Badge tone="purple">הרדמה {ANESTHESIA_TYPE_LABELS[item.anesthesia_type]}</Badge>}
                      {item.requires_hospital && <Badge tone="purple">מצריך אשפוז</Badge>}
                      {item.requires_contrast && <Badge tone="purple">חומר ניגוד</Badge>}
                      {item.has_radiation && <Badge tone="purple">קרינה מייננת</Badge>}
                    </div>
                    <div className="mt-1.5">
                      {isUnit ? (
                        assigned ? (
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-primary hover:underline"
                          >
                            <MonitorCog className="h-3 w-3" /> משויך ל: {assigned} · שינוי שיוך / לו״ז
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:underline"
                          >
                            <MonitorCog className="h-3 w-3" /> לא משויך לחדר או לנותן/ת שירות — שיוך ללו״ז עכשיו
                          </button>
                        )
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
                  {item.price_full != null && (
                    <div className="flex justify-between rounded-md bg-primary/5 px-2 py-1 col-span-2">
                      <span className="text-slate-500">מחיר פריט מלא (P)</span>
                      <span className="font-medium text-slate-700">{formatCurrency(item.price_full)}</span>
                    </div>
                  )}
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
          {/* Code / free-text search against the provider's reference catalog */}
          <div className="relative">
            <Input
              label={`חיפוש ב${CATALOG_KIND_LABELS[catalogKind]} — לפי קוד או טקסט חופשי`}
              placeholder='לדוגמה: "MRI" או "54021"'
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCatalogItemId("");
              }}
            />
            <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-slate-400" />
            {query.trim() && !catalogItemId && (
              <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-2.5">
                    <p className="text-xs text-slate-400">
                      לא נמצאו פריטים מתאימים ב{CATALOG_KIND_LABELS[catalogKind]}
                    </p>
                    {catalogKind === "healson" && query.trim().length >= 2 && (
                      <button
                        type="button"
                        onClick={openRequest}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> בקש להוסיף פריט לקטלוג
                      </button>
                    )}
                  </div>
                ) : (
                  searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickCatalogItem(c)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm hover:bg-slate-50"
                    >
                      <span className="flex items-center gap-2">
                        <Badge tone="slate">{c.tavar_code}</Badge>
                        <span className="text-slate-800">{c.name_he}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatCurrency(c.catalog === "healson" ? c.price_full ?? c.base_price : c.base_price)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedCatalogItem && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="font-medium text-slate-700">
                {CATALOG_CODE_LABELS[selectedCatalogItem.catalog]}: {selectedCatalogItem.tavar_code}
              </span>
              {" · "}
              {selectedCatalogItem.name_he}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {/* Organization types classify by their own catalogue (§PRV-02);
                everyone else keeps the generic 7-way classification. */}
            {serviceCategories ? (
              <Select
                label="קטגוריית הפריט"
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
                required
              >
                <option value="">בחר/י קטגוריה</option>
                {serviceCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            ) : (
              <Select label="סוג פריט" value={serviceType} onChange={(e) => setServiceType(e.target.value as ProviderServiceType)}>
                {clinicalTypes.map((t) => (
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
              {clinicalTypes.map((t) => (
                <option key={t} value={t}>
                  {PROVIDER_SERVICE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}

          {/* Pricing (payments meeting §6). Nothing here is negotiated inside
              this dialog any more: S and H are the Ministry of Health list, and
              K/B are the tariffs Healson agreed with each payer — the provider
              reads all four. Only the full item price P of a Healson item is
              still theirs to set. All layers share the locked-field chrome so
              the one editable box is unmistakable. */}
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">מחירים</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {catalogKind === "healson" && (
                <Input
                  label="מחיר פריט מלא (P)"
                  type="number"
                  value={priceFull}
                  onChange={(e) => setPriceFull(e.target.value)}
                  required
                  className="sm:col-span-2"
                />
              )}
              <LockedPriceField label={`${LAYER_LABELS.S} (S)`} value={mohS} />
              <LockedPriceField label={`${LAYER_LABELS.H} (H)`} value={mohH} />
              {catalogKind === "healson" && (
                <>
                  <LockedPriceField label={`${LAYER_LABELS.K} (K)`} value={tariffK} />
                  <LockedPriceField label={`${LAYER_LABELS.B} (B)`} value={tariffB} />
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {catalogKind === "mabar"
                ? 'המחיר נשלף אוטומטית ממחירון מב"ר של משרד הבריאות לפי קוד הפריט — אין הזנה ידנית.'
                : "S ו-H נקבעים לפי מחירון משרד הבריאות, ותעריפי K ו-B נקבעים מול המשלמים בקטלוג הילסון — כולם לקריאה בלבד."}
            </p>
          </div>

          {/* The per-payer breakdown behind K/B — which קופה plan / carrier is
              an הסדר and what the patient's co-pay is (§6). Read-only. */}
          {catalogKind === "healson" && selectedCatalogItem && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
              <p className="flex items-center gap-1 text-xs font-medium text-slate-600">
                <Lock className="h-3 w-3" /> מחירים לפי משלם
              </p>
              {payerRows.length > 0 ? (
                <PayerPriceTable rows={payerRows} />
              ) : (
                <p className="text-[11px] text-slate-400">
                  טרם הוגדרו מחירים פר משלם לפריט זה בקטלוג הילסון. עד שיוגדרו, הפריט מוצע לפי תעריפי K/B הכלליים
                  שלמעלה.
                </p>
              )}
            </div>
          )}

          {/* An item belongs to a מערך (service line), not to a room or a
              person — that was the old model and it forced a unit to re-pick
              every machine for every item. Narrowing down to individual לו״זים
              stays available for the genuine case where a מערך's עמדות differ. */}
          {isUnit && (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-600">שיוך למערך</p>
              {(serviceArrayTargets?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-400">
                  עדיין לא הוגדרו מערכים ביחידה — ניתן לשייך מאוחר יותר בלשונית &quot;מערכים&quot;.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {serviceArrayTargets!.map((a) => {
                      const picked = selectedArrayIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleTarget(a.id, selectedArrayIds, setSelectedArrayIds)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            picked
                              ? "border-primary bg-primary/10 font-medium text-primary"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {a.name}
                          {a.branchName && <span className="text-slate-400"> · {a.branchName}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {selectedArrayIds.length > 0 && (
                    <>
                      <label className="flex cursor-pointer items-start gap-2 border-t border-slate-100 pt-2.5 text-sm">
                        <input
                          type="checkbox"
                          checked={limitToStations}
                          onChange={(e) => setLimitToStations(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary"
                        />
                        <span>
                          הפריט מבוצע רק בחלק מהעמדות של המערך
                          <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                            ברירת מחדל: כל עמדה במערך שנבחר מבצעת את הפריט לפי הלו״ז שלה.
                          </span>
                        </span>
                      </label>

                      {limitToStations && (
                        <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-2.5">
                          {stationsInSelectedArrays.length === 0 ? (
                            <p className="text-xs text-slate-400">
                              אין עדיין עמדות במערכים שנבחרו — הוסיפו עמדות בלשונית &quot;מערכים&quot;.
                            </p>
                          ) : (
                            stationsInSelectedArrays.map((group) => (
                              <div key={group.arrayId}>
                                <p className="mb-1 text-[11px] font-medium text-slate-500">{group.arrayName}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {group.stations.map((r) => {
                                    const list = r.kind === "facility" ? selectedRoomIds : selectedProviderIds;
                                    const setList = r.kind === "facility" ? setSelectedRoomIds : setSelectedProviderIds;
                                    const picked = list.includes(r.id);
                                    return (
                                      <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => toggleTarget(r.id, list, setList)}
                                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                          picked
                                            ? "border-primary bg-primary/10 font-medium text-primary"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                      >
                                        {r.name}
                                        {!r.hasSchedule && (
                                          <span className="text-[10px] text-warning-text">· ללא לו״ז</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
            {/* Whether a referral gates this item is the unit's call, not a
                platform rule: the box opens on the item type's default (and on
                what the reference catalog says, when the item came from one),
                and stays editable either way. */}
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requiresReferral}
                onChange={(e) => setRequiresReferral(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-primary"
              />
              נדרשת הפניה / אישור מראש מהקופה
            </label>
            <p className="text-[11px] leading-relaxed text-slate-400">
              {requiresReferral
                ? "המטופל יצטרך להעלות הפניה לפני קביעת התור, וההזמנה תמתין לאישורכם."
                : `אין צורך בהפניה — המטופל קובע את ה${itemLabel} ישירות.`}
            </p>

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

          {!isUnit && (
            <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              שיוך הפריט למיקומים נעשה בלשונית &quot;מרפאות&quot; — שם בוחרים לכל מיקום אילו פריטים מוצעים בו.
            </p>
          )}

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

      {/* Request a missing Healson catalog item (§catalog requests) */}
      <Dialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="בקשה להוספת פריט לקטלוג"
        description="הפריט שחיפשת אינו קיים בקטלוג הילסון. שלח/י בקשה קצרה וצוות הילסון יוסיף אותו."
      >
        <div className="flex flex-col gap-3">
          <Input
            label="שם הפריט המבוקש"
            value={reqName}
            onChange={(e) => setReqName(e.target.value)}
            required
          />
          <Select
            label="סוג הפריט"
            value={reqType}
            onChange={(e) => setReqType(e.target.value as ProviderServiceType)}
          >
            {clinicalTypes.map((t) => (
              <option key={t} value={t}>
                {PROVIDER_SERVICE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Textarea
            label="פירוט קצר (אופציונלי)"
            placeholder="למשל: משך הפעולה, האם נדרשת הפניה, ותיאור קליני קצר שיעזור לצוות."
            value={reqDesc}
            onChange={(e) => setReqDesc(e.target.value)}
          />
          <Button onClick={submitRequest} disabled={reqName.trim().length < 2}>
            שלח בקשה
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
