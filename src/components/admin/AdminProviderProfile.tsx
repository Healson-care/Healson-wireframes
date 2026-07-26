"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge, ProviderStatusBadge, ProviderPublishedBadge } from "@/components/ui/Badge";
import { Avatar, EmptyState, OpenDecisionNote } from "@/components/ui/Misc";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { ProgressBar } from "@/components/ui/Progress";
import { ProviderJourneyStepper } from "@/components/provider/ProviderJourneyStepper";
import { MonthlyReportSection } from "@/components/provider/MonthlyReportSection";
import { formatDateHe } from "@/lib/utils";
import {
  DOCTOR_SUBTYPE_LABELS,
  OrganizationBranch,
  ORGANIZATION_MEMBER_TYPES,
  ProviderProfile,
  PROVIDER_TYPE_LABELS,
  ProviderType,
  UploadedFile,
} from "@/types";
import {
  getProviderSetupConfig,
  isCatalogComplete,
  isLocationsComplete,
  isAvailabilityComplete,
} from "@/lib/provider-setup";
import {
  LayoutDashboard,
  FileText,
  History,
  Rocket,
  ShieldCheck,
  Ban,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  Circle,
  FileCheck2,
  UserRound,
  Building2,
  Percent,
  MapPin,
  Stethoscope,
  Handshake,
  CalendarClock,
  FileSignature,
  Network,
  KeyRound,
  Plus,
  Phone,
  Mail,
  IdCard,
  Trash2,
  Pencil,
  MapPinned,
} from "lucide-react";

/** Derives the ordered onboarding-setup checklist (same steps the provider
 * drives) so the admin can see exactly what's done and what's outstanding. */
function onboardingSteps(provider: ProviderProfile) {
  const config = getProviderSetupConfig(provider.provider_type);
  return [
    { key: "sign", label: "חתימת הסכם Healson", icon: FileSignature, ok: !!provider.agreement_signed_at },
    ...(config.showAgreements
      ? [{ key: "agreements", label: "הסדרי ביטוח", icon: Handshake, ok: provider.agreements.length > 0 }]
      : []),
    { key: "catalog", label: config.catalogLabel, icon: Stethoscope, ok: isCatalogComplete(provider) },
    ...(config.locationTypes.length > 0
      ? [{ key: "locations", label: config.locationLabelPlural, icon: MapPin, ok: isLocationsComplete(provider) }]
      : []),
    ...(config.showAvailability
      ? [{ key: "availability", label: "זמינות", icon: CalendarClock, ok: isAvailabilityComplete(provider) }]
      : []),
  ];
}

export function onboardingPercent(provider: ProviderProfile): number {
  const steps = onboardingSteps(provider);
  return steps.length === 0 ? 0 : Math.round((steps.filter((s) => s.ok).length / steps.length) * 100);
}

interface ActivityEvent {
  date: string;
  label: string;
  tone: "primary" | "success" | "info" | "warning" | "danger";
}

function buildActivity(provider: ProviderProfile): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const push = (date: string | undefined, label: string, tone: ActivityEvent["tone"]) => {
    if (date) events.push({ date, label, tone });
  };
  push(provider.created_date, "נרשם למערכת", "info");
  push(provider.application_submitted_at, "הגיש בקשת הצטרפות לבדיקה", "info");
  push(provider.license_verified_at, "הרישיון אומת — עבר לשלב ההצטרפות", "primary");
  push(provider.agreement_signed_at, "חתם על ההסכם עם Healson", "primary");
  push(provider.onboarding_ready_at, "השלים את כל שלבי ההצטרפות", "success");
  push(provider.go_live_requested_at, "ביקש פרסום (Go-Live)", "warning");
  push(provider.bank_account?.submitted_at, "הגיש פרטי חשבון בנק", "info");
  push(provider.bank_account?.verified_at, "חשבון הבנק אומת", "success");
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

function InfoTile({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg bg-slate-50 p-3 ${className ?? ""}`}>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <div className="text-sm font-medium text-slate-900">{children}</div>
    </div>
  );
}

/** A single labelled fact line for the left identity rail. */
function RailFact({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`truncate text-sm text-slate-800 ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
      </div>
    </div>
  );
}

function DocRow({ label, file }: { label: string; file?: UploadedFile }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-slate-600">
        <FileCheck2 className={`h-4 w-4 ${file ? "text-success" : "text-slate-300"}`} />
        {label}
      </span>
      {file ? (
        <a href={file.data_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">
          {file.file_name}
        </a>
      ) : (
        <span className="text-xs text-slate-400">לא צורף</span>
      )}
    </div>
  );
}

/**
 * Enterprise provider profile for the admin panel — a tabbed record (overview /
 * onboarding / documents / activity) reading the LIVE provider from the store
 * (by id) so every admin action reflects instantly, with contextual lifecycle
 * actions in the footer. Textarea-driven flows (reject / request-changes) are
 * delegated back to the page so their canned-reason UI stays in one place.
 */
export function AdminProviderProfile({
  providerId,
  onClose,
  onRequestReject,
  onRequestChanges,
}: {
  providerId: string;
  onClose: () => void;
  onRequestReject: (p: ProviderProfile) => void;
  onRequestChanges: (p: ProviderProfile) => void;
}) {
  const provider = useStore((s) => s.providers.find((p) => p.id === providerId));
  const providers = useStore((s) => s.providers);
  const users = useStore((s) => s.users);
  const orders = useStore((s) => s.orders);
  const verifyProviderLicense = useStore((s) => s.verifyProviderLicense);
  const approveProviderGoLive = useStore((s) => s.approveProviderGoLive);
  const suspendProvider = useStore((s) => s.suspendProvider);
  const reinstateProvider = useStore((s) => s.reinstateProvider);
  const updateProviderById = useStore((s) => s.updateProviderById);
  const setProviderCommission = useStore((s) => s.setProviderCommission);
  const showToast = useStore((s) => s.showToast);

  const [commission, setCommission] = useState<string>(String(provider?.commission_rate ?? 15));

  if (!provider) return null;

  const user = users.find((u) => u.id === provider.user_id);
  const parentOrg = provider.parent_organization_id
    ? providers.find((p) => p.id === provider.parent_organization_id)
    : undefined;
  const steps = onboardingSteps(provider);
  const percent = onboardingPercent(provider);
  const activity = buildActivity(provider);
  const allServices = [...provider.consultation_types, ...provider.exam_types];
  const unlinked = allServices.filter((s) => (s.linked_clinic_ids?.length ?? 0) === 0).length;
  const isSurgeon = provider.doctor_subtype === "surgeon";

  return (
    <div className="flex flex-col gap-4">
      {provider.status === "rejected" && provider.rejection_reason && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
          <span className="font-medium">סיבת הדחייה: </span>
          {provider.rejection_reason}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ── Left identity + actions rail ── */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <div className="flex flex-col gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar name={provider.display_name || "?"} src={provider.image_url} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <h3 className="text-base font-bold leading-tight text-slate-900">
                  {provider.title} {provider.display_name}
                </h3>
                <p className="mt-0.5 text-xs text-amber-700">{provider.specialty || "—"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ProviderStatusBadge status={provider.status} title={provider.status === "rejected" ? provider.rejection_reason : undefined} />
              {provider.is_published && <ProviderPublishedBadge />}
              {provider.is_organization && <Badge tone="purple">ארגון (רשת)</Badge>}
              {provider.provider_type && <Badge tone="slate">{PROVIDER_TYPE_LABELS[provider.provider_type]}</Badge>}
              {isSurgeon && <Badge tone="purple">{DOCTOR_SUBTYPE_LABELS.surgeon}</Badge>}
              {parentOrg && <Badge tone="blue">יחידה בארגון: {parentOrg.display_name}</Badge>}
            </div>
            <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3">
              <RailFact icon={<Phone className="h-3.5 w-3.5" />} label="טלפון" value={provider.contact_phone || user?.phone} />
              <RailFact icon={<Mail className="h-3.5 w-3.5" />} label="אימייל" value={provider.contact_email || user?.email} />
              <RailFact icon={<IdCard className="h-3.5 w-3.5" />} label="מספר רישיון" value={provider.license_number} mono />
            </div>
            {/* Commission — editable inline (setProviderCommission) */}
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Percent className="h-3.5 w-3.5" /> עמלת Healson לעסקה
              </p>
              <div className="flex items-end gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  className="max-w-[110px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={commission === String(provider.commission_rate ?? 15) || commission === ""}
                  onClick={() => {
                    const rate = Math.max(0, Math.min(100, Number(commission) || 0));
                    setProviderCommission(provider.id, rate);
                    setCommission(String(rate));
                    showToast(`עמלת הספק עודכנה ל-${rate}%`, { variant: "success" });
                  }}
                >
                  עדכן
                </Button>
              </div>
            </div>
          </div>

          {/* Contextual lifecycle actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">פעולות</p>
            <div className="flex flex-col gap-2">
                {provider.status === "pending_review" && (
                  <>
                    <Button
                      className="w-full justify-center"
                      onClick={() => {
                        verifyProviderLicense(provider.id);
                        showToast("הרישיון אומת — הספק עבר לשלב האונבורדינג", { variant: "success" });
                      }}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> אמת רישיון
                    </Button>
                    <Button variant="outline" className="w-full justify-center" onClick={() => onRequestReject(provider)}>
                      <Ban className="h-3.5 w-3.5" /> דחה
                    </Button>
                  </>
                )}
                {provider.status === "onboarding" && (
                  <>
                    <Button
                      className="w-full justify-center"
                      disabled={!provider.go_live_requested_at}
                      title={
                        !provider.onboarding_ready_at
                          ? "האונבורדינג טרם הושלם"
                          : !provider.go_live_requested_at
                          ? "הספק טרם ביקש פרסום"
                          : undefined
                      }
                      onClick={() => {
                        approveProviderGoLive(provider.id);
                        showToast("הספק אושר ל-Go-Live ופורסם", { variant: "success" });
                        onClose();
                      }}
                    >
                      <Rocket className="h-3.5 w-3.5" /> אשר Go-Live ופרסם
                    </Button>
                    <Button variant="outline" className="w-full justify-center" onClick={() => onRequestChanges(provider)}>
                      בקש תיקונים
                    </Button>
                    <Button variant="outline" className="w-full justify-center" onClick={() => onRequestReject(provider)}>
                      <Ban className="h-3.5 w-3.5" /> דחה
                    </Button>
                  </>
                )}
                {provider.status === "approved" && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => {
                        updateProviderById(provider.id, { is_published: !provider.is_published });
                        showToast(provider.is_published ? "הפרופיל הוסר מהפרסום" : "הפרופיל פורסם", { variant: "success" });
                      }}
                    >
                      {provider.is_published ? "בטל פרסום" : "פרסם"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => {
                        suspendProvider(provider.id);
                        showToast("הספק הושהה", { variant: "success" });
                      }}
                    >
                      <PauseCircle className="h-3.5 w-3.5" /> השהה
                    </Button>
                  </>
                )}
                {provider.status === "suspended" && (
                  <Button
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => {
                      reinstateProvider(provider.id);
                      showToast("הספק הופעל מחדש", { variant: "success" });
                    }}
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> הפעל מחדש
                  </Button>
                )}
                {provider.status === "rejected" && (
                  <p className="text-xs text-slate-400">הספק נדחה — אין פעולות זמינות.</p>
                )}
              </div>
            </div>
        </aside>

        {/* ── Right column: tabbed record ── */}
        <div>
      <Tabs defaultValue={provider.status === "onboarding" || provider.status === "pending_review" ? "onboarding" : "overview"}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" icon={<LayoutDashboard className="h-3.5 w-3.5" />}>סקירה</TabsTrigger>
          {provider.is_organization && (
            <TabsTrigger value="units" icon={<Network className="h-3.5 w-3.5" />}>יחידות ומשתמשים</TabsTrigger>
          )}
          <TabsTrigger value="onboarding" icon={<Rocket className="h-3.5 w-3.5" />}>הצטרפות</TabsTrigger>
          <TabsTrigger value="documents" icon={<FileText className="h-3.5 w-3.5" />}>מסמכים</TabsTrigger>
          <TabsTrigger value="activity" icon={<History className="h-3.5 w-3.5" />}>פעילות</TabsTrigger>
        </TabsList>

        {/* ---- Overview ---- */}
        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoTile label="איש קשר">
              <span className="flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-slate-400" />
                {provider.contact_name || provider.display_name}
              </span>
            </InfoTile>
            {provider.business_reg_number && (
              <InfoTile label='מס׳ עוסק / ח"פ'>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {provider.business_reg_number}
                </span>
              </InfoTile>
            )}
            {!provider.is_organization && (
              <InfoTile label="משתמש כניסה" className="col-span-2">
                {user ? (
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                    {user.full_name} · <span className="font-normal text-slate-500">{user.email}</span>
                  </span>
                ) : (
                  <ProviderUserCreator providerId={provider.id} defaultName={provider.contact_name || provider.display_name} defaultEmail={provider.contact_email ?? ""} />
                )}
              </InfoTile>
            )}
            {(provider.sub_specialties?.length ?? 0) > 0 && (
              <InfoTile label="תתי-התמחות" className="col-span-2">
                <div className="flex flex-wrap gap-1.5">
                  {provider.sub_specialties!.map((s) => (
                    <Badge key={s} tone="slate">{s}</Badge>
                  ))}
                </div>
              </InfoTile>
            )}
            {(provider.member_provider_types?.length ?? 0) > 0 && (
              <InfoTile label="סוגי ספקים בארגון" className="col-span-2">
                <div className="flex flex-wrap gap-1.5">
                  {provider.member_provider_types!.map((t) => (
                    <Badge key={t} tone="slate">{PROVIDER_TYPE_LABELS[t]}</Badge>
                  ))}
                </div>
              </InfoTile>
            )}
            {provider.bio && (
              <InfoTile label="על אודות (bio)" className="col-span-2">
                <p className="font-normal text-slate-800">{provider.bio}</p>
              </InfoTile>
            )}
            {provider.coordination_notes && (
              <InfoTile label="הנחיות תיאום (פנימי)" className="col-span-2">
                <p className="font-normal text-slate-800">{provider.coordination_notes}</p>
              </InfoTile>
            )}
          </div>

          {provider.status === "approved" && (
            <MonthlyReportSection orders={orders.filter((o) => o.provider_id === provider.id)} providerName={provider.display_name} />
          )}
        </TabsContent>

        {/* ---- Units & users (organizations only) ---- */}
        {provider.is_organization && (
          <TabsContent value="units" className="mt-4">
            <OrganizationUnitsTab organization={provider} />
          </TabsContent>
        )}

        {/* ---- Onboarding ---- */}
        <TabsContent value="onboarding" className="mt-4 flex flex-col gap-4">
          <ProviderJourneyStepper provider={provider} />

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">התקדמות הגדרת הפרופיל</span>
              <span className="tabular-nums font-semibold text-slate-900">{percent}%</span>
            </div>
            <ProgressBar percent={percent} tone={percent === 100 ? "success" : "primary"} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {steps.map((step) => (
              <div key={step.key} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {step.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                )}
                <span className={step.ok ? "text-slate-700" : "text-slate-400"}>{step.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoTile label="חתימת הסכם עם Healson">
              {provider.agreement_signed_at ? formatDateHe(provider.agreement_signed_at) : "טרם נחתם"}
            </InfoTile>
            <InfoTile label="בקשת פרסום (Go-Live)">
              {provider.go_live_requested_at ? formatDateHe(provider.go_live_requested_at) : "טרם ביקש פרסום"}
            </InfoTile>
            <InfoTile label="הסדרי ביטוח" className="col-span-2">
              {provider.agreements.length === 0 ? (
                <span className="text-slate-400">טרם הוגדרו</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(provider.kupah_arrangements ?? []).map((a) => (
                    <Badge key={`${a.kupah}-${a.level}`} tone="slate">{a.level}</Badge>
                  ))}
                  {(provider.private_insurance_companies ?? []).map((c) => (
                    <Badge key={c} tone="purple">{c}</Badge>
                  ))}
                  {(provider.kupah_arrangements ?? []).length === 0 &&
                    (provider.private_insurance_companies ?? []).length === 0 && (
                      <span>{provider.agreements.map((a) => a.layer).join(", ")}</span>
                    )}
                </div>
              )}
            </InfoTile>
            <InfoTile label="מיקומים">{provider.clinic_locations.length} הוגדרו</InfoTile>
            <InfoTile label="קטלוג פריטים">
              {allServices.length} פריטים
              {unlinked > 0 && <p className="mt-0.5 text-xs font-normal text-warning-text">{unlinked} לא משויכים למיקום</p>}
            </InfoTile>
          </div>

          {allServices.length > 0 && (
            <OpenDecisionNote>
              <b>טרם הוחלט:</b> מדיניות תמחור סופית — הספק קבע את המחירים בעצמו; טרם הוחלט אם Healson מאשרת/מגבילה את הטווח.
            </OpenDecisionNote>
          )}
        </TabsContent>

        {/* ---- Documents ---- */}
        <TabsContent value="documents" className="mt-4 flex flex-col gap-2">
          <DocRow label="רישיון מקצועי" file={provider.license_file} />
          <DocRow label="קורות חיים / תעודות" file={provider.medical_resume_file} />
          {isSurgeon && (
            <>
              <DocRow label="תעודת מומחה בתחום ניתוחי (בורד)" file={provider.surgical_board_certificate} />
              <DocRow label="ביטוח אחריות מקצועית" file={provider.malpractice_insurance_file} />
              <InfoTile label="הרשאת ניתוח">{provider.surgical_privileges_hospital || "—"}</InfoTile>
            </>
          )}
          <DocRow label="אישור ניהול חשבון בנק" file={provider.bank_account?.authorization_file} />
        </TabsContent>

        {/* ---- Activity ---- */}
        <TabsContent value="activity" className="mt-4">
          {activity.length === 0 ? (
            <EmptyState icon={<History className="h-9 w-9" />} title="אין פעילות מתועדת" />
          ) : (
            <ol className="flex flex-col gap-0">
              {activity.map((e, i) => {
                const dot =
                  e.tone === "success" ? "bg-success" : e.tone === "warning" ? "bg-warning" : e.tone === "danger" ? "bg-danger" : e.tone === "primary" ? "bg-primary" : "bg-info";
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                      {i < activity.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm text-slate-800">{e.label}</p>
                      <p className="text-xs text-slate-400">{formatDateHe(e.date)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}

/** Creates the login user for a provider/unit (mock auth — shows the one-time
 * temp password to the admin, mirroring verifyProviderLicense's flow). */
function ProviderUserCreator({
  providerId,
  defaultName,
  defaultEmail,
}: {
  providerId: string;
  defaultName: string;
  defaultEmail: string;
}) {
  const createProviderUnitUser = useStore((s) => s.createProviderUnitUser);
  const showToast = useStore((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function handleCreate() {
    const result = createProviderUnitUser(providerId, { full_name: fullName, email, phone: phone || undefined });
    if (!result.ok) {
      showToast(result.error ?? "יצירת המשתמש נכשלה", { variant: "destructive" });
      return;
    }
    setTempPassword(result.tempPassword ?? null);
    showToast("משתמש הכניסה נוצר", { variant: "success" });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound className="h-3.5 w-3.5" /> צור משתמש כניסה
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setTempPassword(null);
        }}
        title="יצירת משתמש כניסה ליחידה"
        description="המשתמש ישמש את היחידה להתחברות לפורטל נותני השירות"
      >
        {tempPassword ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              המשתמש נוצר. סיסמה זמנית (מוצגת פעם אחת בלבד — העבירו אותה ליחידה):
            </p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-center font-mono text-base font-semibold text-slate-900">
              {tempPassword}
            </p>
            <Button
              onClick={() => {
                setOpen(false);
                setTempPassword(null);
              }}
            >
              סגור
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input label="שם מלא" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <Input label="אימייל" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="טלפון (לא חובה)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button onClick={handleCreate} disabled={!fullName.trim() || !email.trim()}>
              צור משתמש
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}

/** A single medical unit row inside a branch. */
function UnitRow({ unit }: { unit: ProviderProfile }) {
  const users = useStore((s) => s.users);
  const unitUser = users.find((u) => u.id === unit.user_id);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-medium text-slate-900">{unit.display_name}</p>
          {unit.provider_type && <Badge tone="slate">{PROVIDER_TYPE_LABELS[unit.provider_type]}</Badge>}
          <ProviderStatusBadge status={unit.status} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {unitUser ? (
            <span className="flex items-center gap-1">
              <KeyRound className="h-3 w-3 text-slate-400" /> {unitUser.full_name} · {unitUser.email}
            </span>
          ) : (
            "אין עדיין משתמש כניסה ליחידה"
          )}
        </p>
      </div>
      {!unitUser && (
        <ProviderUserCreator
          providerId={unit.id}
          defaultName={unit.contact_name || unit.display_name}
          defaultEmail={unit.contact_email ?? ""}
        />
      )}
    </div>
  );
}

/** Organization hierarchy manager (ניהול ספקים / מסך הארגונים): Healson ops
 * builds the org's tree here — ארגון → יחידה רפואית → סניף. The org has one or
 * more medical units (each a full ProviderProfile via parent_organization_id),
 * and each unit has one or more branches (סניפים / physical sites). Reused by
 * both the provider card's tab and /organizations. */
export function OrganizationUnitsTab({ organization }: { organization: ProviderProfile }) {
  const providers = useStore((s) => s.providers);
  const organizationBranches = useStore((s) => s.organizationBranches);
  const addOrganizationBranch = useStore((s) => s.addOrganizationBranch);
  const updateOrganizationBranch = useStore((s) => s.updateOrganizationBranch);
  const deleteOrganizationBranch = useStore((s) => s.deleteOrganizationBranch);
  const addOrganizationUnit = useStore((s) => s.addOrganizationUnit);
  const showToast = useStore((s) => s.showToast);

  const orgUnits = providers.filter((p) => p.parent_organization_id === organization.id);
  const branchesOfUnit = (unitId: string) => organizationBranches.filter((b) => b.unit_id === unitId);
  const totalBranches = organizationBranches.filter((b) => orgUnits.some((u) => u.id === b.unit_id)).length;

  // Add-unit dialog (unit → org)
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitName, setUnitName] = useState("");
  const [unitType, setUnitType] = useState<ProviderType>("medical_institute");
  const [unitSpecialty, setUnitSpecialty] = useState("");
  const [unitLicense, setUnitLicense] = useState("");
  const [unitPhone, setUnitPhone] = useState("");
  const [unitEmail, setUnitEmail] = useState("");

  // Add/edit-branch dialog (branch → unit)
  const [branchUnitId, setBranchUnitId] = useState<string | null>(null);
  const [branchEditing, setBranchEditing] = useState<OrganizationBranch | null>(null);
  const [brName, setBrName] = useState("");
  const [brCity, setBrCity] = useState("");
  const [brAddress, setBrAddress] = useState("");
  const [brPhone, setBrPhone] = useState("");
  const [brEmail, setBrEmail] = useState("");
  const [deleteBranchId, setDeleteBranchId] = useState<string | null>(null);

  function openAddUnit() {
    setUnitName("");
    setUnitType("medical_institute");
    setUnitSpecialty("");
    setUnitLicense("");
    setUnitPhone("");
    setUnitEmail("");
    setUnitOpen(true);
  }
  function saveUnit() {
    const result = addOrganizationUnit(organization.id, {
      display_name: unitName,
      provider_type: unitType,
      specialty: unitSpecialty || undefined,
      license_number: unitLicense || undefined,
      contact_phone: unitPhone || undefined,
      contact_email: unitEmail || undefined,
    });
    if (!result.ok) {
      showToast(result.error ?? "הוספת היחידה נכשלה", { variant: "destructive" });
      return;
    }
    showToast("היחידה הרפואית נוספה לארגון", { variant: "success" });
    setUnitOpen(false);
  }

  function openAddBranch(unitId: string) {
    setBranchEditing(null);
    setBrName("");
    setBrCity("");
    setBrAddress("");
    setBrPhone("");
    setBrEmail("");
    setBranchUnitId(unitId);
  }
  function openEditBranch(b: OrganizationBranch) {
    setBranchEditing(b);
    setBrName(b.name);
    setBrCity(b.city ?? "");
    setBrAddress(b.address ?? "");
    setBrPhone(b.contact_phone ?? "");
    setBrEmail(b.contact_email ?? "");
    setBranchUnitId(b.unit_id);
  }
  function saveBranch() {
    if (!branchUnitId) return;
    const data = {
      name: brName,
      city: brCity || undefined,
      address: brAddress || undefined,
      contact_phone: brPhone || undefined,
      contact_email: brEmail || undefined,
    };
    if (branchEditing) {
      updateOrganizationBranch(branchEditing.id, data);
      showToast("פרטי הסניף עודכנו", { variant: "success" });
    } else {
      const result = addOrganizationBranch(branchUnitId, data);
      if (!result.ok) {
        showToast(result.error ?? "הוספת הסניף נכשלה", { variant: "destructive" });
        return;
      }
      showToast("הסניף נוסף ליחידה", { variant: "success" });
    }
    setBranchUnitId(null);
    setBranchEditing(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {orgUnits.length === 0
            ? "לארגון אין עדיין יחידות רפואיות"
            : `${orgUnits.length} יחידות רפואיות · ${totalBranches} סניפים`}
        </p>
        <Button size="sm" onClick={openAddUnit}>
          <Plus className="h-4 w-4" /> הוספת יחידה
        </Button>
      </div>

      {orgUnits.length === 0 ? (
        <EmptyState
          icon={<Network className="h-9 w-9" />}
          title="אין עדיין יחידות בארגון"
          description="הוסיפו יחידה רפואית (מכון, מרפאת חוץ, מעבדה…) — ואז לכל יחידה מוסיפים סניפים (אתרים פיזיים) וצרו לה משתמש כניסה"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {orgUnits.map((unit) => {
            const branches = branchesOfUnit(unit.id);
            return (
              <div key={unit.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <UnitRow unit={unit} />

                <div className="mt-2.5 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <MapPinned className="h-3.5 w-3.5 text-primary" /> סניפים ({branches.length})
                  </p>
                  <Button size="sm" variant="outline" onClick={() => openAddBranch(unit.id)}>
                    <Plus className="h-3.5 w-3.5" /> סניף
                  </Button>
                </div>

                {branches.length === 0 ? (
                  <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-400">
                    אין עדיין סניפים ליחידה זו — הוסיפו אתר פיזי
                  </p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium text-slate-900">
                            <MapPinned className="h-3.5 w-3.5 text-slate-400" /> {branch.name}
                          </p>
                          {(branch.city || branch.address) && (
                            <p className="mt-0.5 pr-5 text-xs text-slate-500">
                              {[branch.city, branch.address].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditBranch(branch)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="עריכת סניף"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteBranchId(branch.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            title="מחיקת סניף"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add unit (to org) */}
      <Dialog
        open={unitOpen}
        onClose={() => setUnitOpen(false)}
        title="יחידה רפואית חדשה בארגון"
        description="היחידה נוצרת במצב הצטרפות — משתמש היחידה משלים הסכמים, קטלוג וזמינות בפורטל. לאחר מכן מוסיפים לה סניפים."
      >
        <div className="flex flex-col gap-3">
          <Input label="שם היחידה" value={unitName} onChange={(e) => setUnitName(e.target.value)} required />
          <Select label="סוג היחידה" value={unitType} onChange={(e) => setUnitType(e.target.value as ProviderType)}>
            {ORGANIZATION_MEMBER_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROVIDER_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Input label="תחום (לא חובה)" value={unitSpecialty} onChange={(e) => setUnitSpecialty(e.target.value)} />
          <Input label="מספר רישיון (לא חובה)" value={unitLicense} onChange={(e) => setUnitLicense(e.target.value)} />
          <Input label="טלפון (לא חובה)" value={unitPhone} onChange={(e) => setUnitPhone(e.target.value)} />
          <Input label="אימייל (לא חובה)" type="email" value={unitEmail} onChange={(e) => setUnitEmail(e.target.value)} />
          <Button onClick={saveUnit} disabled={!unitName.trim()}>
            הוסף יחידה
          </Button>
        </div>
      </Dialog>

      {/* Add / edit branch (to a unit) */}
      <Dialog
        open={!!branchUnitId}
        onClose={() => {
          setBranchUnitId(null);
          setBranchEditing(null);
        }}
        title={branchEditing ? "עריכת סניף" : "סניף חדש ליחידה"}
        description={branchEditing ? undefined : "סניף הוא אתר פיזי של היחידה הרפואית."}
      >
        <div className="flex flex-col gap-3">
          <Input label="שם הסניף" placeholder="לדוגמה: סניף תל אביב" value={brName} onChange={(e) => setBrName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="עיר (לא חובה)" value={brCity} onChange={(e) => setBrCity(e.target.value)} />
            <Input label="כתובת (לא חובה)" value={brAddress} onChange={(e) => setBrAddress(e.target.value)} />
          </div>
          <Input label="טלפון (לא חובה)" value={brPhone} onChange={(e) => setBrPhone(e.target.value)} />
          <Input label="אימייל (לא חובה)" type="email" value={brEmail} onChange={(e) => setBrEmail(e.target.value)} />
          <Button onClick={saveBranch} disabled={!brName.trim()}>
            {branchEditing ? "שמור" : "הוסף סניף"}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteBranchId}
        onClose={() => setDeleteBranchId(null)}
        title="מחיקת סניף"
        description="הסניף יימחק."
        destructive
        confirmLabel="מחק סניף"
        onConfirm={() => {
          if (!deleteBranchId) return;
          const result = deleteOrganizationBranch(deleteBranchId);
          if (!result.ok) {
            showToast(result.error ?? "מחיקת הסניף נכשלה", { variant: "destructive" });
          } else {
            showToast("הסניף נמחק", { variant: "success" });
          }
          setDeleteBranchId(null);
        }}
      />
    </div>
  );
}
