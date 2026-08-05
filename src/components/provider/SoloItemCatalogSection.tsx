"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, generateId, cn } from "@/lib/utils";
import {
  ANESTHESIA_TYPE_LABELS,
  ANESTHESIA_TYPES,
  AnesthesiaType,
  BRANCH_TYPE_LABELS,
  CONSULTATION_SUBTYPES,
  Clinic,
  ConsultationType,
  KupahArrangement,
  LAYER_LABELS,
  PROVIDER_SERVICE_TYPE_LABELS,
  PayerPrice,
  ProviderServiceType,
  soloServiceTypes,
} from "@/types";
import {
  Plus,
  Pencil,
  Trash2,
  Stethoscope,
  MapPin,
  Search,
  Lock,
  FileText,
  Clock,
  X,
} from "lucide-react";

/** How a specific שב"ן plan settles this item. "none" = no arrangement for it. */
type KMode = "none" | "copay" | "refund";

const K_MODE_LABELS: Record<KMode, string> = {
  none: "אין הסדר",
  copay: "השתתפות עצמית",
  refund: "החזר",
};

interface KRowState {
  mode: KMode;
  price: string;
}

function ageLabel(item: ConsultationType): string {
  if (item.min_age == null && item.max_age == null) return "ללא הגבלת גיל";
  if (item.min_age != null && item.max_age != null) return `גילאי ${item.min_age}–${item.max_age}`;
  if (item.min_age != null) return `מגיל ${item.min_age}`;
  return `עד גיל ${item.max_age}`;
}

/**
 * Item entry for an INDIVIDUAL provider (נותן שירות יחיד — רופא/מטפל).
 *
 * Deliberately NOT the reference-catalog search a medical unit uses: an
 * individual's items are their own, so they write them. What the platform asks
 * for instead is everything that makes the item bookable and priceable:
 *   • what kind of service it is (ייעוץ / טיפול / ניתוח — the last only for a
 *     surgeon), and for a ייעוץ which kind of consultation;
 *   • which of the provider's own sub-specialties it belongs to;
 *   • WHICH BRANCHES it is given at — decided here, at save time, because only
 *     here is the item's TYPE known (a ניתוח may only be assigned to an
 *     operating room). Every branch is pre-selected, so the common case costs
 *     no clicks while the decision still happens in the open, where it is made.
 *     The branches screen shows the same link from the other side;
 *   • the age range it is offered for;
 *   • what the patient must bring/fill BEFORE the appointment;
 *   • the full price P, plus the terms per payer the provider works with —
 *     a שב"ן plan is either a co-pay or a החזר, and a private carrier only ever
 *     says whether it reimburses (there is no B price);
 *   • how long it takes, and how much time to keep free after it.
 *
 * Healson reviews these items as part of the Go-Live approval, so there is no
 * per-item approval gate here.
 */
export function SoloItemCatalogSection({
  items,
  onChange,
  itemLabel,
  subSpecialties,
  kupahArrangements,
  privateInsurers,
  isSurgeon,
  clinics,
  locationLabelSingular = "סניף",
  locationLabelPlural = "סניפים",
}: {
  items: ConsultationType[];
  onChange: (items: ConsultationType[]) => void;
  itemLabel: string;
  /** The provider's own approved sub-specialties — an item belongs to one. */
  subSpecialties: string[];
  /** The קופה+שב"ן plans the provider declared an arrangement with. */
  kupahArrangements: KupahArrangement[];
  /** Private carriers the provider declared an arrangement with. */
  privateInsurers: string[];
  isSurgeon: boolean;
  /** The provider's branches — an item is assigned to the ones it is given at.
   * Configured before items in הקמה, so this is normally non-empty. */
  clinics: Clinic[];
  locationLabelSingular?: string;
  locationLabelPlural?: string;
}) {
  const serviceTypes = soloServiceTypes(isSurgeon);

  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState("");

  // --- form state ---------------------------------------------------------
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState<ProviderServiceType>("consultation");
  const [serviceSubtype, setServiceSubtype] = useState<string>(CONSULTATION_SUBTYPES[0]);
  const [subSpecialty, setSubSpecialty] = useState("");
  const [linkedClinicIds, setLinkedClinicIds] = useState<string[]>([]);
  const [noAgeLimit, setNoAgeLimit] = useState(true);
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [requiredDocs, setRequiredDocs] = useState<{ id: string; label: string }[]>([]);
  const [requiresQuestionnaire, setRequiresQuestionnaire] = useState(false);
  const [questionnaireTitle, setQuestionnaireTitle] = useState("");
  const [priceFull, setPriceFull] = useState("");
  const [kRows, setKRows] = useState<Record<string, KRowState>>({});
  const [bRows, setBRows] = useState<Record<string, boolean>>({});
  const [duration, setDuration] = useState("30");
  const [buffer, setBuffer] = useState("0");
  const [anesthesiaType, setAnesthesiaType] = useState<AnesthesiaType>("local");
  const [recoveryDays, setRecoveryDays] = useState("");
  const [requiresHospital, setRequiresHospital] = useState(false);

  const visibleItems = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.service_subtype ?? "").toLowerCase().includes(q) ||
        (i.sub_specialty ?? "").toLowerCase().includes(q)
    );
  }, [items, listFilter]);

  function resetForm() {
    setName("");
    setServiceType("consultation");
    setServiceSubtype(CONSULTATION_SUBTYPES[0]);
    setSubSpecialty(subSpecialties[0] ?? "");
    // Every branch, pre-selected: offering a new item everywhere is the common
    // case, so the default costs no clicks — but it is a real, visible value
    // the provider can narrow, not an empty field that means "everywhere".
    setLinkedClinicIds(clinics.map((c) => c.id));
    setNoAgeLimit(true);
    setMinAge("");
    setMaxAge("");
    setRequiredDocs([]);
    setRequiresQuestionnaire(false);
    setQuestionnaireTitle("");
    setPriceFull("");
    setKRows(
      Object.fromEntries(kupahArrangements.map((a) => [a.level, { mode: "copay" as KMode, price: "" }]))
    );
    setBRows(Object.fromEntries(privateInsurers.map((i) => [i, false])));
    setDuration("30");
    setBuffer("0");
    setAnesthesiaType("local");
    setRecoveryDays("");
    setRequiresHospital(false);
  }

  function openCreate() {
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(item: ConsultationType) {
    setEditingId(item.id);
    resetForm();
    setName(item.name);
    setServiceType(item.service_type ?? "consultation");
    setServiceSubtype(item.service_subtype ?? CONSULTATION_SUBTYPES[0]);
    setSubSpecialty(item.sub_specialty ?? subSpecialties[0] ?? "");
    // Items created before this field existed carry no links, and used to mean
    // "everywhere" by omission — open them on the equivalent explicit value so
    // editing an old item doesn't silently un-offer it.
    setLinkedClinicIds(
      (item.linked_clinic_ids?.length ?? 0) > 0 ? item.linked_clinic_ids! : clinics.map((c) => c.id)
    );
    setNoAgeLimit(item.min_age == null && item.max_age == null);
    setMinAge(item.min_age != null ? String(item.min_age) : "");
    setMaxAge(item.max_age != null ? String(item.max_age) : "");
    setRequiredDocs(item.required_documents ?? []);
    setRequiresQuestionnaire(!!item.requires_questionnaire);
    setQuestionnaireTitle(item.questionnaire_title ?? "");
    setPriceFull(item.price_full != null ? String(item.price_full) : "");
    setKRows(
      Object.fromEntries(
        kupahArrangements.map((a) => {
          const row = (item.payer_prices ?? []).find((p) => p.layer === "K" && p.level === a.level);
          if (!row) return [a.level, { mode: "none" as KMode, price: "" }];
          return [
            a.level,
            row.mode === "החזר"
              ? { mode: "refund" as KMode, price: "" }
              : { mode: "copay" as KMode, price: row.price != null ? String(row.price) : "" },
          ];
        })
      )
    );
    setBRows(
      Object.fromEntries(
        privateInsurers.map((ins) => [
          ins,
          (item.payer_prices ?? []).some((p) => p.layer === "B" && p.insurer === ins),
        ])
      )
    );
    setDuration(String(item.duration_minutes));
    setBuffer(String(item.buffer_minutes ?? 0));
    setAnesthesiaType(item.anesthesia_type ?? "local");
    setRecoveryDays(item.recovery_days != null ? String(item.recovery_days) : "");
    setRequiresHospital(!!item.requires_hospital);
    setOpen(true);
  }

  // §2 (payments meeting): everything except a consultation is referral-gated.
  const referralLocked = serviceType !== "consultation";

  function buildPayerPrices(): PayerPrice[] {
    const rows: PayerPrice[] = [];
    for (const arrangement of kupahArrangements) {
      const row = kRows[arrangement.level];
      if (!row || row.mode === "none") continue;
      rows.push({
        layer: "K",
        kupah: arrangement.kupah,
        level: arrangement.level,
        mode: row.mode === "refund" ? "החזר" : "הסדר",
        price: row.mode === "copay" && row.price !== "" ? Number(row.price) || 0 : undefined,
      });
    }
    for (const insurer of privateInsurers) {
      // Layer B carries no price for an individual provider — only whether the
      // carrier reimburses the patient at all.
      if (bRows[insurer]) rows.push({ layer: "B", insurer, mode: "החזר" });
    }
    return rows;
  }

  function handleSave() {
    const existing = editingId ? items.find((i) => i.id === editingId) : undefined;
    const id = editingId ?? generateId("item");
    const newItem: ConsultationType = {
      ...existing,
      id,
      name: name.trim(),
      is_custom: true,
      duration_minutes: Number(duration) || 30,
      buffer_minutes: Number(buffer) || undefined,
      // Nothing is read off a reference catalog here, so there are no layer
      // list-prices: P is the price, and the payer rows qualify it.
      prices: existing?.prices ?? [],
      price_full: priceFull !== "" ? Number(priceFull) || 0 : undefined,
      payer_prices: buildPayerPrices(),
      service_type: serviceType,
      service_subtype: serviceType === "consultation" ? serviceSubtype : undefined,
      sub_specialty: subSpecialty || undefined,
      min_age: noAgeLimit || minAge === "" ? undefined : Number(minAge),
      max_age: noAgeLimit || maxAge === "" ? undefined : Number(maxAge),
      required_documents: requiredDocs.filter((d) => d.label.trim()).length
        ? requiredDocs.filter((d) => d.label.trim())
        : undefined,
      requires_questionnaire: requiresQuestionnaire || undefined,
      questionnaire_title: requiresQuestionnaire ? questionnaireTitle.trim() || "שאלון לפני הפגישה" : undefined,
      requires_referral: referralLocked,
      anesthesia_type: serviceType === "surgery" ? anesthesiaType : undefined,
      recovery_days: serviceType === "surgery" && recoveryDays ? Number(recoveryDays) : undefined,
      requires_hospital: serviceType === "surgery" ? requiresHospital : undefined,
      linked_clinic_ids: linkedClinicIds,
    };
    onChange(editingId ? items.map((i) => (i.id === editingId ? newItem : i)) : [...items, newItem]);
    setOpen(false);
  }

  const canSave =
    name.trim().length > 1 &&
    priceFull !== "" &&
    (subSpecialties.length === 0 || !!subSpecialty) &&
    // An item given at no branch is an item no patient can book — block the
    // save rather than storing something unreachable. (A provider with no
    // branches at all is a different case: nothing to pick, so nothing to fail.)
    (clinics.length === 0 || linkedClinicIds.length > 0) &&
    (serviceType !== "consultation" || !!serviceSubtype);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-slate-500">
          הפריטים כאן הם שלך — כותבים אותם בעצמכם. צוות Healson עובר עליהם כחלק מאישור הפרסום.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> הוספת {itemLabel}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="mb-3">
          <Input
            icon={<Search className="h-4 w-4" />}
            placeholder={`חיפוש לפי שם, סוג או תת-התמחות (${items.length} ${itemLabel}ים)`}
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-10 w-10" />}
          title={`אין ${itemLabel}ים מוגדרים`}
          description="הוסיפו את הפריט הראשון שלכם — ייעוץ, טיפול או ניתוח."
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState icon={<Search className="h-10 w-10" />} title="לא נמצאו פריטים תואמים" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleItems.map((item) => {
            const kRowsOf = (item.payer_prices ?? []).filter((p) => p.layer === "K");
            const bRowsOf = (item.payer_prices ?? []).filter((p) => p.layer === "B");
            return (
              <Card key={item.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="blue">
                        {item.service_type ? PROVIDER_SERVICE_TYPE_LABELS[item.service_type] : "פריט"}
                      </Badge>
                      {item.service_subtype && <Badge tone="slate">{item.service_subtype}</Badge>}
                      {item.sub_specialty && <Badge tone="purple">{item.sub_specialty}</Badge>}
                      <Badge tone={item.min_age == null && item.max_age == null ? "slate" : "amber"}>
                        {ageLabel(item)}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {item.requires_referral && <Badge tone="amber">דורש הפניה</Badge>}
                      {item.requires_questionnaire && <Badge tone="amber">שאלון מקדים</Badge>}
                      {(item.required_documents?.length ?? 0) > 0 && (
                        <Badge tone="amber">{item.required_documents!.length} מסמכים נדרשים</Badge>
                      )}
                      {item.requires_hospital && <Badge tone="purple">מצריך אשפוז</Badge>}
                    </div>
                    <div className="mt-1.5">
                      {(item.linked_clinic_ids?.length ?? 0) > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {item.linked_clinic_ids!.length === clinics.length && clinics.length > 0
                            ? `מוצע בכל ה${locationLabelPlural}`
                            : `מוצע ב-${item.linked_clinic_ids!.length} ${locationLabelPlural}`}
                        </span>
                      ) : (
                        // Only reachable for items saved before the branch field
                        // existed, or while the provider has no branches at all.
                        <span className="flex items-center gap-1 text-[11px] text-warning-text">
                          <MapPin className="h-3 w-3" /> לא משויך לאף {locationLabelSingular} — ערכו את ה
                          {itemLabel} כדי לשייך
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      aria-label={`עריכת ${item.name}`}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      aria-label={`מחיקת ${item.name}`}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-1.5 text-xs">
                  {item.price_full != null && (
                    <div className="flex justify-between rounded-md bg-primary/5 px-2 py-1">
                      <span className="text-slate-500">מחיר מלא (P)</span>
                      <span className="font-medium text-slate-700">{formatCurrency(item.price_full)}</span>
                    </div>
                  )}
                  {kRowsOf.map((row) => (
                    <div key={row.level} className="flex justify-between rounded-md bg-slate-50 px-2 py-1">
                      <span className="text-slate-500">{row.level}</span>
                      <span className="font-medium text-slate-700">
                        {row.mode === "החזר"
                          ? "החזר מהקופה"
                          : row.price != null
                          ? `השתתפות עצמית ${formatCurrency(row.price)}`
                          : "הסדר"}
                      </span>
                    </div>
                  ))}
                  {bRowsOf.length > 0 && (
                    <div className="flex justify-between rounded-md bg-slate-50 px-2 py-1">
                      <span className="text-slate-500">החזר מביטוח פרטי</span>
                      <span className="font-medium text-slate-700">
                        {bRowsOf.map((r) => r.insurer).join(", ")}
                      </span>
                    </div>
                  )}
                  {/* Items entered before per-payer terms existed still carry
                      plain layer prices — show them rather than a blank card. */}
                  {(item.payer_prices?.length ?? 0) === 0 &&
                    item.prices.map((p) => (
                      <div key={p.layer} className="flex justify-between rounded-md bg-slate-50 px-2 py-1">
                        <span className="text-slate-500">{LAYER_LABELS[p.layer]}</span>
                        <span className="font-medium text-slate-700">{formatCurrency(p.price)}</span>
                      </div>
                    ))}
                </div>

                {/* Timing closes the card — it's operational detail, not what
                    the item IS. */}
                <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {item.duration_minutes} דק׳
                  </span>
                  {!!item.buffer_minutes && <span>+ {item.buffer_minutes} דק׳ באפר</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? `עריכת ${itemLabel}` : `${itemLabel} חדש`}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-3.5">
          {/* 1 — what kind of service this is. Everything else follows from it. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">סוג השירות</span>
            <div className="flex gap-2">
              {serviceTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setServiceType(t)}
                  aria-pressed={serviceType === t}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    serviceType === t
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {PROVIDER_SERVICE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {!isSurgeon && (
              <p className="text-[11px] text-slate-400">
                פריטי ניתוח זמינים לרופא/ה מנתח/ת בלבד, לאחר הגדרת הרשאות הניתוח.
              </p>
            )}
          </div>

          {serviceType === "consultation" && (
            <Select
              label="תת-סוג הייעוץ"
              value={serviceSubtype}
              onChange={(e) => setServiceSubtype(e.target.value)}
              required
            >
              {CONSULTATION_SUBTYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}

          {/* 2 — which of the provider's own sub-specialties it belongs to. */}
          {subSpecialties.length > 0 ? (
            <Select
              label="תת-התמחות שאליה הפריט שייך"
              value={subSpecialty}
              onChange={(e) => setSubSpecialty(e.target.value)}
              required
            >
              <option value="">בחר/י תת-התמחות</option>
              {subSpecialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          ) : (
            <p className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-text">
              לא הוגדרו תתי-התמחות בפרופיל שלך, ולכן אי אפשר לשייך את הפריט. ניתן להוסיף תת-התמחות דרך בקשת
              שינוי בפרופיל.
            </p>
          )}

          <Input
            label={`שם ה${itemLabel}`}
            placeholder="לדוגמה: ייעוץ ראשוני בקשב וריכוז"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* 3 — age range. */}
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
            <span className="text-xs font-medium text-slate-600">טווח גילאים</span>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noAgeLimit}
                onChange={(e) => setNoAgeLimit(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-primary"
              />
              ללא הגבלת גיל
            </label>
            {!noAgeLimit && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="number"
                  min={0}
                  label="מגיל"
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                />
                <Input
                  type="number"
                  min={0}
                  label="עד גיל"
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 4 — where it is given. Assigned here, not on the branches screen,
              because this is the only place that knows the item's type: a
              ניתוח belongs in an operating room, a ייעוץ in a clinic. */}
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400" /> {locationLabelPlural} שבהם ניתן ה{itemLabel}
              </span>
              {clinics.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLinkedClinicIds(
                      linkedClinicIds.length === clinics.length ? [] : clinics.map((c) => c.id)
                    )
                  }
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {linkedClinicIds.length === clinics.length ? "נקה הכל" : "בחר הכל"}
                </button>
              )}
            </div>
            {clinics.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-warning-text">
                עדיין לא הוגדרו {locationLabelPlural}. אפשר לשמור את ה{itemLabel} ולשייך אותו בהמשך מתוך
                לשונית ה{locationLabelPlural}.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {clinics.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={linkedClinicIds.includes(c.id)}
                        onChange={() =>
                          setLinkedClinicIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 accent-primary"
                      />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {BRANCH_TYPE_LABELS[c.location_type ?? "clinic"]}
                      </span>
                    </label>
                  ))}
                </div>
                {linkedClinicIds.length === 0 && (
                  <p className="text-[11px] font-medium text-danger-text">
                    יש לבחור {locationLabelSingular} אחד לפחות — אחרת ה{itemLabel} לא יופיע לאף מטופל.
                  </p>
                )}
              </>
            )}
          </div>

          {/* 5 — what the patient must bring or fill BEFORE the appointment.
              Each entry becomes a pending document on the booking, so the
              appointment never starts with something missing. */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <FileText className="h-3.5 w-3.5 text-slate-400" /> מסמכים שנדרשים לפני התור
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRequiredDocs([...requiredDocs, { id: generateId("doc"), label: "" }])}
              >
                <Plus className="h-3.5 w-3.5" /> מסמך
              </Button>
            </div>
            {requiredDocs.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                לא נדרשים מסמכים. דוגמה: לייעוץ קשב וריכוז — שאלון מורה שיש להביא לפגישה.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {requiredDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2">
                    <input
                      value={doc.label}
                      placeholder="שם המסמך שהמטופל צריך להביא"
                      onChange={(e) =>
                        setRequiredDocs(
                          requiredDocs.map((d) => (d.id === doc.id ? { ...d, label: e.target.value } : d))
                        )
                      }
                      className="h-9 flex-1 rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setRequiredDocs(requiredDocs.filter((d) => d.id !== doc.id))}
                      aria-label="הסרת מסמך"
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 border-t border-slate-100 pt-2 text-sm">
              <input
                type="checkbox"
                checked={requiresQuestionnaire}
                onChange={(e) => setRequiresQuestionnaire(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-primary"
              />
              נדרש שאלון מקוון לפני הפגישה
            </label>
            {requiresQuestionnaire && (
              <Input
                label="שם השאלון"
                placeholder="לדוגמה: שאלון מורה (קונרס)"
                value={questionnaireTitle}
                onChange={(e) => setQuestionnaireTitle(e.target.value)}
              />
            )}

            <label
              className={cn(
                "flex items-center gap-2 text-sm",
                referralLocked ? "cursor-default" : "cursor-pointer"
              )}
            >
              <input
                type="checkbox"
                checked={referralLocked}
                disabled
                className="h-4 w-4 rounded border-slate-300 accent-primary disabled:opacity-70"
              />
              נדרשת הפניה / אישור מראש מהקופה
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Lock className="h-3 w-3" />
                {referralLocked ? "חובה לפריט שאינו ייעוץ" : "ייעוץ אינו דורש הפניה"}
              </span>
            </label>
          </div>

          {/* 6 — prices. */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">מחירים</p>
            <Input
              label="מחיר מלא לפריט (P) ₪"
              type="number"
              min={0}
              value={priceFull}
              onChange={(e) => setPriceFull(e.target.value)}
              hint="המחיר שמטופל ללא כיסוי משלם. כל שאר המחירים נגזרים ממנו."
              required
            />

            <div className="border-t border-slate-100 pt-2.5">
              <p className="mb-1.5 text-xs font-medium text-slate-600">
                שב&quot;ן (K) — לפי התוכניות שאיתן יש לך הסדר
              </p>
              {kupahArrangements.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  לא הוגדרו הסדרים עם קופות. ניתן להגדיר אותם בלשונית &quot;הסדרי ביטוח&quot;.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {kupahArrangements.map((a) => {
                    const row = kRows[a.level] ?? { mode: "none" as KMode, price: "" };
                    return (
                      <div key={`${a.kupah}-${a.level}`} className="rounded-lg bg-slate-50 p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-700">{a.level}</span>
                          <div className="flex gap-1">
                            {(["copay", "refund", "none"] as KMode[]).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setKRows({ ...kRows, [a.level]: { ...row, mode } })}
                                aria-pressed={row.mode === mode}
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                                  row.mode === mode
                                    ? "bg-primary text-white"
                                    : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                                )}
                              >
                                {K_MODE_LABELS[mode]}
                              </button>
                            ))}
                          </div>
                        </div>
                        {row.mode === "copay" && (
                          <input
                            type="number"
                            min={0}
                            value={row.price}
                            onChange={(e) => setKRows({ ...kRows, [a.level]: { ...row, price: e.target.value } })}
                            placeholder="סכום ההשתתפות העצמית ₪"
                            aria-label={`השתתפות עצמית ${a.level}`}
                            className="mt-2 h-9 w-full rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        )}
                        {row.mode === "refund" && (
                          <p className="mt-1.5 text-[11px] text-slate-500">
                            המטופל משלם את המחיר המלא ומגיש תביעה להחזר לקופה בעצמו.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-2.5">
              <p className="mb-1.5 text-xs font-medium text-slate-600">ביטוח פרטי (B) — האם יש החזר</p>
              {privateInsurers.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  לא הוגדרו חברות ביטוח פרטיות. ניתן להגדיר אותן בלשונית &quot;הסדרי ביטוח&quot;.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {privateInsurers.map((ins) => (
                      <button
                        key={ins}
                        type="button"
                        onClick={() => setBRows({ ...bRows, [ins]: !bRows[ins] })}
                        aria-pressed={!!bRows[ins]}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          bRows[ins]
                            ? "bg-primary text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {ins}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    סמנו את החברות שמעניקות החזר על הפריט הזה. בביטוח פרטי אין מחיר הסדר — המטופל משלם את
                    המחיר המלא ומגיש תביעה להחזר.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Surgery-only logistics. */}
          {serviceType === "surgery" && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-600">פרטי הניתוח</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="סוג הרדמה"
                  value={anesthesiaType}
                  onChange={(e) => setAnesthesiaType(e.target.value as AnesthesiaType)}
                >
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
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requiresHospital}
                  onChange={(e) => setRequiresHospital(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-primary"
                />
                מצריך אשפוז בבית חולים
              </label>
            </div>
          )}

          {/* 7 — timing, last: how long it takes and how much to keep free after. */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">משך ותזמון</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="משך הפריט (דקות)"
                type="number"
                min={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
              <Input
                label="באפר אחרי הפריט (דקות)"
                type="number"
                min={0}
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
                hint="זמן חסום שלא ניתן להזמנה — סיכום, ניקיון, הכנה לתור הבא."
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={!canSave}>
            שמירת {itemLabel}
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
