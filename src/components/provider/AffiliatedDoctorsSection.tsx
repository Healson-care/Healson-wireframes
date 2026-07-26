"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState, Avatar } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/file";
import {
  AffiliatedDoctor,
  Clinic,
  ConsultationType,
  OrganizationBranch,
  ProviderProfile,
  ServiceArray,
  UploadedFile,
  isUnitProviderType,
} from "@/types";
import { hasAnyAvailability, totalWeeklyHours } from "@/lib/schedule";
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  Layers,
  Link2,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";

const TITLES = ['ד"ר', "פרופ'"];

/** Doctors working under an organization (§PRV-07 — outpatient clinics and
 * medical institutes).
 *
 * Every consultation-based service is actually delivered by a doctor, so the
 * organization manages its roster here and links each doctor to the services
 * they deliver. A doctor is never duplicated: while the "add doctor" form is
 * being filled, the platform is searched for a matching record (license
 * number / phone / email / exact name) and, on a hit, the user is offered the
 * existing doctor to affiliate instead of creating a second record. */
/** Which catalogue entries actually need a doctor behind them. Consultation-
 * based services always do; product-like entries ("ציוד רפואי") don't, so they
 * must not be counted as "unstaffed". */
function requiresDoctor(service: ConsultationType): boolean {
  if (service.service_type === "product") return false;
  if (service.service_category) {
    return !["ציוד רפואי", "שירותים נוספים"].includes(service.service_category);
  }
  return true;
}

export function AffiliatedDoctorsSection({ provider }: { provider: ProviderProfile }) {
  const providers = useStore((s) => s.providers);
  const organizationBranches = useStore((s) => s.organizationBranches);
  const serviceArrays = useStore((s) => s.serviceArrays);
  const findMatchingDoctors = useStore((s) => s.findMatchingDoctors);
  const addAffiliatedDoctor = useStore((s) => s.addAffiliatedDoctor);
  const linkExistingDoctorToOrganization = useStore((s) => s.linkExistingDoctorToOrganization);
  const updateAffiliatedDoctor = useStore((s) => s.updateAffiliatedDoctor);
  const removeAffiliatedDoctor = useStore((s) => s.removeAffiliatedDoctor);
  const showToast = useStore((s) => s.showToast);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AffiliatedDoctor | null>(null);
  const [removing, setRemoving] = useState<AffiliatedDoctor | null>(null);

  const affiliations = provider.affiliated_doctors ?? [];
  const doctorById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  const services = provider.consultation_types;

  // This unit's branches + מערכים, and a resolver for a doctor's מערך → name/branch.
  const unitBranches = organizationBranches.filter((b) => b.unit_id === provider.id);
  const unitArrays = serviceArrays.filter((a) => unitBranches.some((b) => b.id === a.branch_id));
  const arrayById = new Map(unitArrays.map((a) => [a.id, a]));
  const resolveArray = (a: AffiliatedDoctor) => {
    const arr = a.service_array_id ? arrayById.get(a.service_array_id) : undefined;
    return {
      key: arr?.id ?? "__none__",
      name: arr?.name ?? "ללא מערך",
      branchId: arr?.branch_id ?? a.branch_id ?? "__none__",
      branchName: unitBranches.find((b) => b.id === (arr?.branch_id ?? a.branch_id))?.name ?? "ללא סניף",
    };
  };
  // A medical unit is a single site, so there is no location to pick between —
  // what matters there is the doctor's own schedule, set in "זמינות" (§PRV-08).
  const clinics = isUnitProviderType(provider.provider_type) ? [] : provider.clinic_locations;

  // Services that need a doctor but have nobody assigned — the reason this
  // section exists, so it's surfaced rather than left implicit. In a unit a
  // service performed on a מתקן (MRI ראש on MRI 1) is already covered, so it
  // must not be counted as "unstaffed" here (§PRV-08).
  const facilityServiceIds = new Set((provider.facilities ?? []).flatMap((f) => f.service_ids));
  const doctorServices = services.filter((s) => requiresDoctor(s) && !facilityServiceIds.has(s.id));
  const unstaffedServices = doctorServices.filter(
    (s) => !affiliations.some((a) => a.service_ids.includes(s.id))
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-900">נותני שירות משויכים</p>
            <p className="text-xs text-slate-500">
              {affiliations.length} נותני שירות · {doctorServices.length - unstaffedServices.length} מתוך{" "}
              {doctorServices.length} פריטים מאוישים
              {isUnitProviderType(provider.provider_type) && " · הזמינות נקבעת לכל נותן/ת שירות בנפרד"}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" /> הוספת נותן/ת שירות
        </Button>
      </Card>

      {affiliations.length > 0 && unstaffedServices.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-text">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {unstaffedServices.length} פריטים עדיין ללא נותן/ת שירות משויך/ת:{" "}
            {unstaffedServices.map((s) => s.name).join(", ")}
          </span>
        </div>
      )}

      {affiliations.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-10 w-10" />}
          title="לא שויכו עדיין נותני שירות"
          description="כל פריט המבוסס על ייעוץ מתבצע בפועל על ידי נותן/ת שירות. הוסיפו את נותני השירות הפועלים אצלכם ושייכו אותם לפריטים הרלוונטיים."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {(() => {
            type Grp = {
              branchId: string;
              branchName: string;
              arrays: { key: string; name: string; items: AffiliatedDoctor[] }[];
            };
            const groups: Grp[] = [];
            affiliations.forEach((aff) => {
              const r = resolveArray(aff);
              let bg = groups.find((g) => g.branchId === r.branchId);
              if (!bg) {
                bg = { branchId: r.branchId, branchName: r.branchName, arrays: [] };
                groups.push(bg);
              }
              let ag = bg.arrays.find((a) => a.key === r.key);
              if (!ag) {
                ag = { key: r.key, name: r.name, items: [] };
                bg.arrays.push(ag);
              }
              ag.items.push(aff);
            });
            return groups.map((bg) => (
              <div key={bg.branchId} className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-0.5">
                  <MapPinned className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold text-slate-900">{bg.branchName}</p>
                </div>
                {bg.arrays.map((ag) => (
                  <div key={ag.key} className="mr-2">
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Layers className="h-3.5 w-3.5 text-primary" /> {ag.name} · {ag.items.length} נותני שירות
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ag.items.map((affiliation) => {
            const doctor = doctorById.get(affiliation.doctor_provider_id);
            if (!doctor) return null;
            const linkedServices = services.filter((s) => affiliation.service_ids.includes(s.id));
            const otherOrgs = (doctor.organization_provider_ids ?? []).filter((id) => id !== provider.id);
            return (
              <Card key={affiliation.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={doctor.display_name} src={doctor.image_url} className="h-10 w-10 text-xs" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {doctor.title} {doctor.display_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">{doctor.specialty}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {affiliation.role && <Badge tone="info">{affiliation.role}</Badge>}
                        {doctor.license_number && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <BadgeCheck className="h-3 w-3" /> {doctor.license_number}
                          </span>
                        )}
                        {otherOrgs.length > 0 && (
                          <Badge tone="purple">משויך/ת ל-{otherOrgs.length} ארגונים נוספים</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditing(affiliation)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                      aria-label="עריכת שיוך"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setRemoving(affiliation)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="הסרת שיוך"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-1 text-[11px] font-medium text-slate-500">פריטים משויכים</p>
                  {linkedServices.length === 0 ? (
                    <p className="text-xs text-slate-400">לא שויכו פריטים</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {linkedServices.map((s) => (
                        <Badge key={s.id} tone="slate">
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {clinics.length > 0 && (affiliation.clinic_ids?.length ?? 0) > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                    <MapPin className="h-3 w-3" />
                    {clinics
                      .filter((c) => affiliation.clinic_ids!.includes(c.id))
                      .map((c) => c.name)
                      .join(" · ")}
                  </p>
                )}

                {/* In a unit the doctor is a bookable resource, so whether they
                    have a week of their own is the thing to surface here. */}
                {isUnitProviderType(provider.provider_type) && (
                  <p
                    className={cn(
                      "mt-2 flex items-center gap-1 text-[11px]",
                      hasAnyAvailability(affiliation) ? "text-slate-500" : "text-warning-text font-medium"
                    )}
                  >
                    <CalendarClock className="h-3 w-3" />
                    {hasAnyAvailability(affiliation)
                      ? `${totalWeeklyHours(affiliation).toFixed(1)} שעות פעילות בשבוע`
                      : 'לא הוגדר לוח זמנים — הגדירו בלשונית "זמינות"'}
                  </p>
                )}
              </Card>
            );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      )}

      <AddDoctorDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        services={services}
        clinics={clinics}
        alreadyAffiliatedIds={affiliations.map((a) => a.doctor_provider_id)}
        findMatchingDoctors={findMatchingDoctors}
        onCreate={(data) => {
          const result = addAffiliatedDoctor(provider.id, data);
          if (!result.ok) {
            showToast(result.error ?? "שגיאה בהוספת נותן/ת השירות", { variant: "destructive" });
            return false;
          }
          showToast("נותן/ת השירות נוסף/ה ושויך/ה", {
            description: "הרישיון יועבר לאימות צוות Healson",
            variant: "success",
          });
          setAddOpen(false);
          return true;
        }}
        onLink={(doctorId, data) => {
          const result = linkExistingDoctorToOrganization(provider.id, doctorId, data);
          if (!result.ok) {
            showToast(result.error ?? "שגיאה בשיוך", { variant: "destructive" });
            return false;
          }
          showToast("נותן/ת השירות הקיים/ת שויך/ה לארגון", { variant: "success" });
          setAddOpen(false);
          return true;
        }}
      />

      <EditAffiliationDialog
        affiliation={editing}
        doctor={editing ? doctorById.get(editing.doctor_provider_id) : undefined}
        services={services}
        clinics={clinics}
        serviceArrays={unitArrays}
        branches={unitBranches}
        onClose={() => setEditing(null)}
        onSave={(data) => {
          if (editing) {
            updateAffiliatedDoctor(provider.id, editing.id, data);
            showToast("פרטי השיוך עודכנו", { variant: "success" });
          }
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="הסרת שיוך נותן/ת שירות"
        description="נותן/ת השירות יוסר/תוסר מהארגון ומהפריטים המשויכים. רשומת נותן/ת השירות עצמה נשמרת במערכת."
        destructive
        confirmLabel="הסר שיוך"
        onConfirm={() => {
          if (removing) {
            removeAffiliatedDoctor(provider.id, removing.id);
            showToast("שיוך נותן/ת השירות הוסר", { variant: "success" });
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add flow — search existing first, create only if genuinely new
// ---------------------------------------------------------------------------

interface AffiliationInput {
  role?: string;
  service_ids?: string[];
  clinic_ids?: string[];
}

function AddDoctorDialog({
  open,
  onClose,
  services,
  clinics,
  alreadyAffiliatedIds,
  findMatchingDoctors,
  onCreate,
  onLink,
}: {
  open: boolean;
  onClose: () => void;
  services: ConsultationType[];
  clinics: Clinic[];
  alreadyAffiliatedIds: string[];
  findMatchingDoctors: (q: {
    license_number?: string;
    phone?: string;
    email?: string;
    full_name?: string;
  }) => ProviderProfile[];
  onCreate: (data: Parameters<ReturnType<typeof useStore.getState>["addAffiliatedDoctor"]>[1]) => boolean;
  onLink: (doctorId: string, data: AffiliationInput) => boolean;
}) {
  const skillDomains = useStore((s) => s.skillDomains);
  const searchDoctors = useStore((s) => s.searchDoctors);

  // Two explicit ways in (§PRV-07): look the doctor up in the platform, or
  // create a brand-new record. Search is the default — most doctors an
  // organization adds already exist somewhere on the platform.
  const [mode, setMode] = useState<"search" | "create">("search");
  const [search, setSearch] = useState("");
  const [pickedDoctorId, setPickedDoctorId] = useState<string | null>(null);

  const [title, setTitle] = useState(TITLES[0]);
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [role, setRole] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [clinicIds, setClinicIds] = useState<string[]>([]);
  const [dismissedMatches, setDismissedMatches] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live duplicate detection — runs on every keystroke of the identifying
  // fields, so the "this doctor already exists" prompt appears while the user
  // is still typing rather than only on submit.
  const matches = useMemo(() => {
    if (!open) return [];
    return findMatchingDoctors({
      license_number: licenseNumber.trim() || undefined,
      phone: phone.replace(/\D/g, "").length >= 9 ? phone : undefined,
      email: email.trim() || undefined,
      full_name: fullName.trim().length >= 3 ? fullName.trim() : undefined,
    });
  }, [open, findMatchingDoctors, licenseNumber, phone, email, fullName]);

  const newMatches = matches.filter((m) => !alreadyAffiliatedIds.includes(m.id));
  const alreadyLinked = matches.filter((m) => alreadyAffiliatedIds.includes(m.id));
  const showMatches = !dismissedMatches && (newMatches.length > 0 || alreadyLinked.length > 0);

  const allProviders = useStore((s) => s.providers);
  const searchResults = useMemo(() => (open ? searchDoctors(search) : []), [open, search, searchDoctors]);
  const pickedDoctor = allProviders.find((p) => p.id === pickedDoctorId);

  function reset() {
    setMode("search");
    setSearch("");
    setPickedDoctorId(null);
    setTitle(TITLES[0]);
    setFullName("");
    setSpecialty("");
    setLicenseNumber("");
    setPhone("");
    setEmail("");
    setLicenseFile(null);
    setRole("");
    setServiceIds([]);
    setClinicIds([]);
    setDismissedMatches(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCreate() {
    if (!fullName.trim() || !specialty) return;
    setBusy(true);
    let uploaded: UploadedFile | undefined;
    try {
      if (licenseFile) {
        uploaded = {
          file_name: licenseFile.name,
          uploaded_at: new Date().toISOString(),
          data_url: await fileToDataUrl(licenseFile),
        };
      }
    } catch {
      uploaded = undefined;
    }
    const ok = onCreate({
      display_name: fullName.trim(),
      title,
      specialty,
      license_number: licenseNumber.trim() || undefined,
      contact_phone: phone.trim() || undefined,
      contact_email: email.trim() || undefined,
      license_file: uploaded,
      role: role.trim() || undefined,
      service_ids: serviceIds,
      clinic_ids: clinicIds,
    });
    setBusy(false);
    if (ok) reset();
  }

  return (
    <Dialog open={open} onClose={handleClose} title="הוספת נותן/ת שירות לארגון" className="max-w-2xl">
      <div className="flex flex-col gap-3">
        {/* Two ways in — look up an existing doctor, or create a new record. */}
        <div className="flex gap-2">
          {(
            [
              ["search", "חיפוש נותן/ת שירות קיים/ת במערכת"],
              ["create", "הוספת נותן/ת שירות חדש/ה"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                mode === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "search" ? (
          <SearchExistingDoctor
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPickedDoctorId(null);
            }}
            results={searchResults}
            alreadyAffiliatedIds={alreadyAffiliatedIds}
            pickedDoctor={pickedDoctor}
            onPick={setPickedDoctorId}
            onSwitchToCreate={() => setMode("create")}
          />
        ) : null}

        {mode === "search" && pickedDoctor && (
          <>
            <Input label="תפקיד בארגון (לא חובה)" placeholder="רופא/ה בכיר/ה" value={role} onChange={(e) => setRole(e.target.value)} />
            <ServicePicker services={services} value={serviceIds} onChange={setServiceIds} />
            <ClinicPicker clinics={clinics} value={clinicIds} onChange={setClinicIds} />
            <Button
              onClick={() => {
                const ok = onLink(pickedDoctor.id, {
                  role: role.trim() || undefined,
                  service_ids: serviceIds,
                  clinic_ids: clinicIds,
                });
                if (ok) reset();
              }}
            >
              <Link2 className="h-4 w-4" /> שייך את {pickedDoctor.display_name} לארגון
            </Button>
          </>
        )}

        {mode === "create" && (
        <>
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          התחילו להזין את פרטי נותן/ת השירות. אם נותן/ת השירות כבר קיים/ת במערכת — נזהה זאת ונציע לשייך את הרשומה
          הקיימת, כדי שלא ייווצרו כפילויות.
        </p>

        {/* Duplicate detection banner. */}
        {showMatches && (
          <div className="rounded-xl border border-info-border bg-info-bg p-3">
            <div className="mb-2 flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-info-text" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-info-text">נמצאה רשומת נותן/ת שירות קיימת במערכת</p>
                <p className="text-xs text-info-text/80">
                  בחרו את נותן/ת השירות הקיים/ת כדי לשייך אותו/ה לארגון — הרשומה נשמרת אחת בלבד.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedMatches(true)}
                className="shrink-0 text-[11px] font-medium text-info-text hover:underline"
              >
                זה לא אותו/ה נותן/ת שירות
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {newMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-info-border bg-white px-3 py-2"
                >
                  <Avatar name={m.display_name} className="h-8 w-8 text-[11px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {m.title} {m.display_name}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {m.specialty}
                      {m.license_number ? ` · רישיון ${m.license_number}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const ok = onLink(m.id, {
                        role: role.trim() || undefined,
                        service_ids: serviceIds,
                        clinic_ids: clinicIds,
                      });
                      // Same as the create path: clear the form, or reopening
                      // the dialog re-fires the duplicate banner for the
                      // doctor that was just linked.
                      if (ok) reset();
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" /> שייך נותן/ת שירות קיים/ת
                  </Button>
                </div>
              ))}
              {alreadyLinked.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"
                >
                  <Avatar name={m.display_name} className="h-8 w-8 text-[11px]" />
                  <span className="flex-1 truncate">
                    {m.title} {m.display_name}
                  </span>
                  <Badge tone="success">כבר משויך/ת לארגון</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="תואר" value={title} onChange={(e) => setTitle(e.target.value)}>
            {TITLES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            label="שם מלא"
            className="sm:col-span-2"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setDismissedMatches(false);
            }}
            required
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="תחום התמחות" value={specialty} onChange={(e) => setSpecialty(e.target.value)} required>
            <option value="">בחר/י תחום התמחות</option>
            {skillDomains.map((d) => (
              <option key={d.id} value={d.name_he}>
                {d.name_he}
              </option>
            ))}
          </Select>
          <Input
            label="מספר רישיון רפואי"
            icon={<BadgeCheck className="h-4 w-4" />}
            value={licenseNumber}
            onChange={(e) => {
              setLicenseNumber(e.target.value);
              setDismissedMatches(false);
            }}
            hint="המזהה החזק ביותר לאיתור נותן/ת שירות קיים/ת"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="tel"
            label="טלפון"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setDismissedMatches(false);
            }}
          />
          <Input
            type="email"
            label="אימייל"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setDismissedMatches(false);
            }}
          />
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          רישיון רפואי (PDF / JPG / PNG)
          <span className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 transition-colors hover:border-primary hover:bg-primary/5">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">{licenseFile ? licenseFile.name : "בחר קובץ"}</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => setLicenseFile(e.target.files?.[0] ?? null)}
            />
          </span>
        </label>

        <Input label="תפקיד בארגון (לא חובה)" placeholder="רופא/ה בכיר/ה" value={role} onChange={(e) => setRole(e.target.value)} />

        <ServicePicker services={services} value={serviceIds} onChange={setServiceIds} />
        <ClinicPicker clinics={clinics} value={clinicIds} onChange={setClinicIds} />

        <Button onClick={handleCreate} loading={busy} disabled={!fullName.trim() || !specialty}>
          <Plus className="h-4 w-4" /> יצירת רשומה חדשה ושיוך לארגון
        </Button>
        </>
        )}
      </div>
    </Dialog>
  );
}

/** The "חיפוש רופא/ה קיים/ת" half of the add flow: free-text roster search over
 * the doctors already on the platform, so an organization links an existing
 * record instead of typing a second copy of the same person. */
function SearchExistingDoctor({
  search,
  onSearchChange,
  results,
  alreadyAffiliatedIds,
  pickedDoctor,
  onPick,
  onSwitchToCreate,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  results: ProviderProfile[];
  alreadyAffiliatedIds: string[];
  pickedDoctor?: ProviderProfile;
  onPick: (id: string) => void;
  onSwitchToCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Input
        label="חיפוש במערכת"
        icon={<Search className="h-4 w-4" />}
        placeholder="שם, מספר רישיון, התמחות, טלפון או אימייל"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        hint="נותן/ת שירות קיים/ת משויך/ת לארגון — הרשומה נשמרת אחת בלבד ולא נוצרת כפילות"
      />

      {search.trim().length < 2 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
          הזינו לפחות שני תווים כדי לחפש. אם נותן/ת השירות עדיין לא רשום/ה במערכת —{" "}
          <button type="button" onClick={onSwitchToCreate} className="font-medium text-primary hover:underline">
            הוסיפו רשומה חדשה
          </button>
          .
        </p>
      ) : results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500">
          לא נמצא/ה נותן/ת שירות תואם/ת ל&quot;{search}&quot;.{" "}
          <button type="button" onClick={onSwitchToCreate} className="font-medium text-primary hover:underline">
            הוספת נותן/ת שירות חדש/ה
          </button>
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
          {results.map((doctor) => {
            const linked = alreadyAffiliatedIds.includes(doctor.id);
            const picked = pickedDoctor?.id === doctor.id;
            return (
              <button
                key={doctor.id}
                type="button"
                disabled={linked}
                onClick={() => onPick(doctor.id)}
                className={cn(
                  "flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-right transition-colors last:border-b-0",
                  linked ? "cursor-not-allowed opacity-60" : "hover:bg-primary/5",
                  picked && "bg-primary/10"
                )}
              >
                <Avatar name={doctor.display_name} src={doctor.image_url} className="h-8 w-8 text-[11px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {doctor.title} {doctor.display_name}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {doctor.specialty}
                    {doctor.license_number ? ` · רישיון ${doctor.license_number}` : ""}
                  </span>
                </span>
                {linked ? (
                  <Badge tone="success">כבר בארגון</Badge>
                ) : picked ? (
                  <Badge tone="blue">נבחר/ה</Badge>
                ) : (
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type AffiliationEdit = Partial<
  Pick<AffiliatedDoctor, "role" | "service_ids" | "clinic_ids" | "service_array_id" | "branch_id">
>;

function EditAffiliationDialog({
  affiliation,
  doctor,
  services,
  clinics,
  serviceArrays,
  branches,
  onClose,
  onSave,
}: {
  affiliation: AffiliatedDoctor | null;
  doctor?: ProviderProfile;
  services: ConsultationType[];
  clinics: Clinic[];
  serviceArrays: ServiceArray[];
  branches: OrganizationBranch[];
  onClose: () => void;
  onSave: (data: AffiliationEdit) => void;
}) {
  return (
    <Dialog
      open={!!affiliation}
      onClose={onClose}
      title={doctor ? `${doctor.title} ${doctor.display_name}` : "עריכת שיוך"}
      description="מערך, תפקיד בארגון, פריטים ומיקומים"
      className="max-w-lg"
    >
      {affiliation && (
        <EditAffiliationForm
          key={affiliation.id}
          affiliation={affiliation}
          services={services}
          clinics={clinics}
          serviceArrays={serviceArrays}
          branches={branches}
          onSave={onSave}
        />
      )}
    </Dialog>
  );
}

function EditAffiliationForm({
  affiliation,
  services,
  clinics,
  serviceArrays,
  branches,
  onSave,
}: {
  affiliation: AffiliatedDoctor;
  services: ConsultationType[];
  clinics: Clinic[];
  serviceArrays: ServiceArray[];
  branches: OrganizationBranch[];
  onSave: (data: AffiliationEdit) => void;
}) {
  const [role, setRole] = useState(affiliation.role ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(affiliation.service_ids);
  const [clinicIds, setClinicIds] = useState<string[]>(affiliation.clinic_ids ?? []);
  const [serviceArrayId, setServiceArrayId] = useState(affiliation.service_array_id ?? "");

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="מערך (קו שירות)"
        value={serviceArrayId}
        onChange={(e) => setServiceArrayId(e.target.value)}
        hint={
          serviceArrays.length === 0
            ? 'הגדירו סניפים ומערכים בלשונית "סניפים ומערכים"'
            : "הסניף נקבע לפי המערך שנבחר"
        }
      >
        <option value="">ללא מערך</option>
        {branches.map((b) => {
          const bArrays = serviceArrays.filter((a) => a.branch_id === b.id);
          if (bArrays.length === 0) return null;
          return (
            <optgroup key={b.id} label={b.name}>
              {bArrays.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </Select>
      <Input label="תפקיד בארגון" value={role} onChange={(e) => setRole(e.target.value)} />
      <ServicePicker services={services} value={serviceIds} onChange={setServiceIds} />
      <ClinicPicker clinics={clinics} value={clinicIds} onChange={setClinicIds} />
      <Button
        onClick={() => {
          const chosen = serviceArrayId ? serviceArrays.find((a) => a.id === serviceArrayId) : undefined;
          onSave({
            role: role.trim() || undefined,
            service_ids: serviceIds,
            clinic_ids: clinicIds,
            service_array_id: serviceArrayId || undefined,
            branch_id: chosen?.branch_id ?? affiliation.branch_id,
          });
        }}
      >
        שמור שיוך
      </Button>
    </div>
  );
}

function ServicePicker({
  services,
  value,
  onChange,
}: {
  services: ConsultationType[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Stethoscope className="h-3.5 w-3.5 text-slate-400" /> פריטים שנותן/ת השירות מבצע/ת
        </span>
        {services.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(value.length === services.length ? [] : services.map((s) => s.id))}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            {value.length === services.length ? "נקה הכל" : "בחר הכל"}
          </button>
        )}
      </div>
      {services.length === 0 ? (
        <p className="text-xs text-slate-400">אין עדיין פריטים בקטלוג — הוסיפו פריטים כדי לשייך אותם לנותני השירות.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {services.map((s) => {
            const picked = value.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange(picked ? value.filter((id) => id !== s.id) : [...value, s.id])}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  picked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClinicPicker({
  clinics,
  value,
  onChange,
}: {
  clinics: Clinic[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (clinics.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <MapPin className="h-3.5 w-3.5 text-slate-400" /> מיקומים
      </span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {clinics.map((c) => {
          const picked = value.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(picked ? value.filter((id) => id !== c.id) : [...value, c.id])}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                picked
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
