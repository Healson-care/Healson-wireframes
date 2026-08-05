"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { generateId } from "@/lib/utils";
import { Clinic, ConsultationType, LocationType, BRANCH_TYPE_LABELS, VIRTUAL_PLATFORMS } from "@/types";
import { Plus, Pencil, Trash2, Star, MapPin, Stethoscope, MapPinned, TriangleAlert } from "lucide-react";

const PHYSICAL_LOCATION_TYPES: LocationType[] = ["clinic", "store"];

/**
 * The three kinds of סניף are not the same form with fields greyed out — they
 * are different questions. A מרפאה has an address the patient travels to; a
 * ביקורי בית has no address of its own (the patient's home is the address), it
 * has the areas the provider covers; an אונליין branch has neither, only how
 * the meeting happens. Asking a home-visit branch for a street address, or an
 * online one for a city, produced fields that were either left blank or filled
 * with something meaningless.
 *
 * `city` carries the service areas for a home visit rather than a new field:
 * patient search filters on it (see lib/search.ts), so reusing it keeps a
 * home-visit branch findable by the cities it serves.
 */
interface BranchTypeFields {
  nameLabel: string;
  namePlaceholder: string;
  showCity: boolean;
  cityLabel: string;
  cityPlaceholder: string;
  showAddress: boolean;
  phoneRequired: boolean;
  showTravelNote: boolean;
  showVirtualPlatform: boolean;
  note: string;
}

function branchFields(type: LocationType, singular: string): BranchTypeFields {
  const base = {
    nameLabel: `שם ה${singular}`,
    namePlaceholder: "",
    showCity: true,
    cityLabel: "עיר",
    cityPlaceholder: "",
    showAddress: true,
    phoneRequired: true,
    showTravelNote: false,
    showVirtualPlatform: false,
    note: "",
  };
  switch (type) {
    case "home_visit":
      return {
        ...base,
        nameLabel: "שם השירות",
        namePlaceholder: "ביקורי בית — גוש דן",
        cityLabel: "ערי שירות",
        cityPlaceholder: "תל אביב, רמת גן, גבעתיים",
        showAddress: false,
        showTravelNote: true,
        note: "בביקור בית הכתובת היא של המטופל — כאן מגדירים לאן אתם מגיעים. הערים שתזינו הן אלה שבהן תופיעו בחיפוש.",
      };
    case "virtual":
      return {
        ...base,
        nameLabel: "שם השירות",
        namePlaceholder: "ייעוץ מרחוק",
        showCity: false,
        showAddress: false,
        phoneRequired: false,
        showVirtualPlatform: true,
        note: "לפגישה מרחוק אין כתובת. הקישור או פרטי החיבור נשלחים למטופל יחד עם אישור התור.",
      };
    case "store":
      return { ...base, namePlaceholder: "סניף דיזנגוף סנטר" };
    default:
      return { ...base, namePlaceholder: "מרפאת רמת אביב" };
  }
}

const EMPTY_HOURS: Clinic["hours"] = {
  sunday: null,
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: null,
  friday: null,
  saturday: null,
};

export function ClinicsSection({
  clinics,
  onChange,
  allowedLocationTypes = ["clinic"],
  locationLabelSingular = "מרפאה",
  locationLabelPlural = "מרפאות",
  singleLocation = false,
  unitName,
  services = [],
  onServicesChange,
}: {
  clinics: Clinic[];
  onChange: (clinics: Clinic[]) => void;
  allowedLocationTypes?: LocationType[];
  locationLabelSingular?: string;
  locationLabelPlural?: string;
  /** Medical units (§PRV-08): the unit IS the site — exactly one address
   * record, never a list. The add/delete/primary affordances and the
   * per-location service linking all disappear, since there is nothing to
   * choose between: every service of the unit is delivered at the unit. */
  singleLocation?: boolean;
  /** The unit's own name (ProviderProfile.display_name). In single-location
   * mode the site has no separate name — it IS the unit — so the name field is
   * dropped and this value is stored on the location record instead. */
  unitName?: string;
  /** The provider's catalog items. Service↔location linking is owned HERE (the
   * location side): each location picks which services it offers, which writes
   * back to each service's `linked_clinic_ids`. */
  services?: ConsultationType[];
  onServicesChange?: (services: ConsultationType[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    phone: "",
    travelNote: "",
    virtualPlatform: VIRTUAL_PLATFORMS[0] as string,
  });
  const [locationType, setLocationType] = useState<LocationType>(allowedLocationTypes[0] ?? "clinic");
  const [linkedServiceIds, setLinkedServiceIds] = useState<string[]>([]);
  const isPhysical = PHYSICAL_LOCATION_TYPES.includes(locationType);
  const fields = branchFields(locationType, locationLabelSingular);

  function servicesAtClinic(clinicId: string) {
    return services.filter((s) => s.linked_clinic_ids?.includes(clinicId));
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      name: "",
      address: "",
      city: "",
      phone: "",
      travelNote: "",
      virtualPlatform: VIRTUAL_PLATFORMS[0],
    });
    setLocationType(allowedLocationTypes[0] ?? "clinic");
    setLinkedServiceIds([]);
    setOpen(true);
  }

  function openEdit(clinic: Clinic) {
    setEditingId(clinic.id);
    setForm({
      name: clinic.name,
      address: clinic.address,
      city: clinic.city,
      phone: clinic.phone,
      travelNote: clinic.travel_note ?? "",
      virtualPlatform: clinic.virtual_platform ?? VIRTUAL_PLATFORMS[0],
    });
    setLocationType(clinic.location_type ?? allowedLocationTypes[0] ?? "clinic");
    setLinkedServiceIds(servicesAtClinic(clinic.id).map((s) => s.id));
    setOpen(true);
  }

  function toggleService(id: string) {
    setLinkedServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  // Rewrite every service's linked_clinic_ids so this clinic appears on exactly
  // the services the user just checked — the location side is the source of
  // truth for the link.
  function applyServiceLinks(clinicId: string) {
    if (!onServicesChange) return;
    onServicesChange(
      services.map((s) => {
        const current = s.linked_clinic_ids ?? [];
        const shouldLink = linkedServiceIds.includes(s.id);
        const has = current.includes(clinicId);
        if (shouldLink === has) return s;
        return {
          ...s,
          linked_clinic_ids: shouldLink ? [...current, clinicId] : current.filter((c) => c !== clinicId),
        };
      })
    );
  }

  function handleSave() {
    const id = editingId ?? generateId("clinic");
    const existing = editingId ? clinics.find((c) => c.id === editingId) : undefined;
    const newClinic: Clinic = {
      // Spread the existing record first so scheduling data owned by the
      // availability screen (schedule / schedule_exceptions / hours) survives
      // an edit here — this dialog only owns the location's identity fields.
      ...existing,
      id,
      // A unit's site carries the unit's own name — never a second one.
      name: singleLocation ? unitName ?? form.name : form.name,
      // Only the fields this branch type actually asked for are stored — a type
      // switched mid-edit must not leave a stale address on an online branch.
      address: fields.showAddress ? form.address : "",
      city: fields.showCity ? form.city : "",
      phone: form.phone,
      travel_note: fields.showTravelNote && form.travelNote.trim() ? form.travelNote.trim() : undefined,
      virtual_platform: fields.showVirtualPlatform ? form.virtualPlatform : undefined,
      is_primary: existing?.is_primary ?? clinics.length === 0,
      hours: existing?.hours ?? EMPTY_HOURS,
      location_type: locationType,
    };

    if (editingId) {
      onChange(clinics.map((c) => (c.id === editingId ? newClinic : c)));
    } else {
      onChange([...clinics, newClinic]);
    }
    // A single-site unit has nothing to link against — every service is
    // delivered at the unit, and which *resource* delivers it is set on the
    // מתקנים / רופאים screens instead.
    if (!singleLocation) applyServiceLinks(id);
    setOpen(false);
  }

  function setPrimary(id: string) {
    onChange(clinics.map((c) => ({ ...c, is_primary: c.id === id })));
  }

  function handleDelete(id: string) {
    onChange(clinics.filter((c) => c.id !== id));
    // Detach the deleted location from any service that referenced it.
    if (onServicesChange) {
      onServicesChange(
        services.map((s) =>
          s.linked_clinic_ids?.includes(id)
            ? { ...s, linked_clinic_ids: s.linked_clinic_ids.filter((c) => c !== id) }
            : s
        )
      );
    }
  }

  const hideAdd = singleLocation && clinics.length > 0;

  return (
    <div>
      {singleLocation && (
        <p className="mb-3 flex items-start gap-1.5 rounded-lg border border-info-border bg-info-bg px-3 py-2 text-xs text-info-text">
          <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ליחידה רפואית אין סניפים — היחידה עצמה היא הסניף. כאן מגדירים את כתובת היחידה ופרטי ההתקשרות שלה; חלוקת
          העבודה בתוך היחידה נעשית דרך החדרים ונותני השירות.
        </p>
      )}
      {!hideAdd && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> {singleLocation ? "הגדרת פרטי היחידה" : `הוסף ${locationLabelSingular}`}
          </Button>
        </div>
      )}

      {clinics.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-10 w-10" />}
          title={singleLocation ? "טרם הוגדרו פרטי היחידה" : `אין ${locationLabelPlural} מוגדרות`}
        />
      ) : (
        <div className={singleLocation ? "grid gap-3" : "grid sm:grid-cols-2 gap-3"}>
          {clinics.map((c) => {
            const linked = servicesAtClinic(c.id);
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {singleLocation ? (
                        <Badge tone="green">היחידה עצמה</Badge>
                      ) : (
                        c.is_primary && <Badge tone="green">{locationLabelSingular} ראשית</Badge>
                      )}
                      {allowedLocationTypes.length > 1 && (
                        <Badge tone="slate">{BRANCH_TYPE_LABELS[c.location_type ?? "clinic"]}</Badge>
                      )}
                    </div>
                    {/* Each type reads back what it was actually asked for —
                        an address for a clinic, service areas for a home visit,
                        the meeting channel for an online branch. */}
                    {c.location_type === "virtual" ? (
                      c.virtual_platform && (
                        <p className="mt-1 text-xs text-slate-500">{c.virtual_platform}</p>
                      )
                    ) : c.location_type === "home_visit" ? (
                      <>
                        {c.city && <p className="mt-1 text-xs text-slate-500">מגיעים ל: {c.city}</p>}
                        {c.travel_note && <p className="text-xs text-slate-400">{c.travel_note}</p>}
                      </>
                    ) : (
                      (c.address || c.city) && (
                        <p className="text-xs text-slate-500 mt-1">{c.address}{c.address && c.city ? ", " : ""}{c.city}</p>
                      )
                    )}
                    {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                    <div className={singleLocation ? "hidden" : "mt-1.5"}>
                      {linked.length > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Stethoscope className="h-3 w-3" /> {linked.length} פריטים מוצעים כאן
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-warning-text font-medium">
                          <TriangleAlert className="h-3 w-3" /> לא שויכו פריטים למיקום זה
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!singleLocation && (
                      <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {!singleLocation && !c.is_primary && (
                  <button
                    onClick={() => setPrimary(c.id)}
                    className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Star className="h-3 w-3" /> הגדר כראשית
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={
          singleLocation
            ? "פרטי היחידה"
            : editingId
              ? `עריכת ${locationLabelSingular}`
              : `${locationLabelSingular} חדש/ה`
        }
        description={
          singleLocation
            ? `${unitName ?? ""} — שם היחידה נערך בלשונית "הגדרות"`.trim()
            : undefined
        }
        className="max-w-xl"
      >
        <div className="flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Full-width fields need the span on the GRID CELL — Input/Select
                forward className to the inner control, not to their wrapper. */}
            {allowedLocationTypes.length > 1 && (
              <div className="sm:col-span-2">
                <Select
                  label={`סוג ה${locationLabelSingular}`}
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value as LocationType)}
                >
                  {allowedLocationTypes.map((t) => (
                    <option key={t} value={t}>
                      {BRANCH_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {!singleLocation && (
              <Input
                label={fields.nameLabel}
                placeholder={fields.namePlaceholder}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            )}
            {fields.showCity && (
              <div className={fields.showAddress ? undefined : "sm:col-span-2"}>
                <Input
                  label={fields.cityLabel}
                  placeholder={fields.cityPlaceholder}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
              </div>
            )}
            {fields.showAddress && (
              <Input
                label="כתובת"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            )}
            {fields.showVirtualPlatform && (
              <div className="sm:col-span-2">
                <Select
                  label="איך מתקיימת הפגישה"
                  value={form.virtualPlatform}
                  onChange={(e) => setForm({ ...form, virtualPlatform: e.target.value })}
                >
                  {VIRTUAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className={fields.showVirtualPlatform ? "sm:col-span-2" : undefined}>
              <Input
                label={fields.phoneRequired ? "טלפון" : "טלפון (לא חובה)"}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required={fields.phoneRequired}
              />
            </div>
            {fields.showTravelNote && (
              <div className="sm:col-span-2">
                <Input
                  label="תנאי הגעה (לא חובה)"
                  placeholder="עד 20 ק״מ מתל אביב · תוספת נסיעה 50 ₪"
                  value={form.travelNote}
                  onChange={(e) => setForm({ ...form, travelNote: e.target.value })}
                />
              </div>
            )}
          </div>
          {isPhysical ? (
            <p className="flex items-start gap-1.5 rounded-lg bg-info-bg border border-info-border px-3 py-2 text-xs text-info-text">
              <MapPinned className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              במערכת המלאה הכתובת תתחבר לכתובות אמיתיות ותוצג על מפה אינטראקטיבית (כאן בהדגמה מזינים את הכתובת כטקסט חופשי).
            </p>
          ) : (
            <p className="flex items-start gap-1.5 rounded-lg border border-info-border bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-text">
              <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {fields.note}
            </p>
          )}

          {/* Service↔location linking is DECIDED in the item form (an item picks
              its branches when it is saved, all of them by default — see
              SoloItemCatalogSection). This checklist is the same link seen from
              the other side: convenient for "this one branch, against my 20
              items", and the only place to fix a branch added after the items.
              A single-site unit skips it — every service is delivered at the
              unit, and the resource that delivers it is picked elsewhere. */}
          <div className={singleLocation ? "hidden" : undefined}>
            {services.length === 0 ? (
              <p >
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {services.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={linkedServiceIds.includes(s.id)}
                      onChange={() => toggleService(s.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-primary"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            {singleLocation
              ? 'את שעות הפעילות של היחידה — ואת לוחות הזמנים של כל חדר ונותן/ת שירות — מגדירים בלשונית "זמינות".'
              : 'את שעות הפעילות אפשר להגדיר בשלב הבא, בלשונית "זמינות".'}
          </p>
          <Button onClick={handleSave}>שמור {singleLocation ? "פרטי היחידה" : locationLabelSingular}</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={`מחיקת ${locationLabelSingular}`}
        description={(() => {
          if (!deleteId) return undefined;
          const affected = servicesAtClinic(deleteId);
          if (affected.length === 0) return "פעולה זו אינה ניתנת לביטול.";
          const names = affected.slice(0, 3).map((s) => s.name).join(", ");
          return `שימו לב: ${affected.length} פריטים מוצעים במיקום זה (${names}${
            affected.length > 3 ? " ועוד" : ""
          }). לאחר המחיקה הם לא יופיעו בחיפוש עד שישויכו למיקום אחר. פעולה זו אינה ניתנת לביטול.`;
        })()}
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) handleDelete(deleteId);
        }}
      />
    </div>
  );
}
