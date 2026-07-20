"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge, ProviderStatusBadge, ProviderPublishedBadge } from "@/components/ui/Badge";
import { Avatar, EmptyState, OpenDecisionNote } from "@/components/ui/Misc";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/Progress";
import { ProviderJourneyStepper } from "@/components/provider/ProviderJourneyStepper";
import { MonthlyReportSection } from "@/components/provider/MonthlyReportSection";
import { formatDateHe } from "@/lib/utils";
import { DOCTOR_SUBTYPE_LABELS, ProviderProfile, PROVIDER_TYPE_LABELS, UploadedFile } from "@/types";
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
  const steps = onboardingSteps(provider);
  const percent = onboardingPercent(provider);
  const activity = buildActivity(provider);
  const allServices = [...provider.consultation_types, ...provider.exam_types];
  const unlinked = allServices.filter((s) => (s.linked_clinic_ids?.length ?? 0) === 0).length;
  const isSurgeon = provider.doctor_subtype === "surgeon";

  return (
    <div className="flex flex-col gap-4">
      {/* Identity header */}
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={provider.display_name || "?"} src={provider.image_url} className="h-12 w-12 text-base" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">
              {provider.title} {provider.display_name}
            </h3>
            <ProviderStatusBadge status={provider.status} title={provider.status === "rejected" ? provider.rejection_reason : undefined} />
            {provider.is_published && <ProviderPublishedBadge />}
            {provider.provider_type && <Badge tone="slate">{PROVIDER_TYPE_LABELS[provider.provider_type]}</Badge>}
            {isSurgeon && <Badge tone="purple">{DOCTOR_SUBTYPE_LABELS.surgeon}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-amber-700">{provider.specialty || "—"}</p>
        </div>
      </div>

      {provider.status === "rejected" && provider.rejection_reason && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
          <span className="font-medium">סיבת הדחייה: </span>
          {provider.rejection_reason}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" icon={<LayoutDashboard className="h-3.5 w-3.5" />}>סקירה</TabsTrigger>
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
            <InfoTile label="טלפון / אימייל">
              <p>{provider.contact_phone || user?.phone || "—"}</p>
              <p className="text-xs font-normal text-slate-500">{provider.contact_email || user?.email || "—"}</p>
            </InfoTile>
            {provider.business_reg_number && (
              <InfoTile label='מס׳ עוסק / ח"פ'>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {provider.business_reg_number}
                </span>
              </InfoTile>
            )}
            <InfoTile label="מספר רישיון">
              <span className="font-mono">{provider.license_number || "—"}</span>
            </InfoTile>
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

          {/* Commission — editable inline (setProviderCommission) */}
          <div className="rounded-lg border border-slate-200 p-3">
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
                className="max-w-[120px]"
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
                עדכן עמלה
              </Button>
            </div>
          </div>

          {provider.status === "approved" && (
            <MonthlyReportSection orders={orders.filter((o) => o.provider_id === provider.id)} providerName={provider.display_name} />
          )}
        </TabsContent>

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
            <InfoTile label="קטלוג שירותים">
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

      {/* Contextual lifecycle actions */}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
        {provider.status === "pending_review" && (
          <>
            <Button variant="outline" size="sm" onClick={() => onRequestReject(provider)}>
              <Ban className="h-3.5 w-3.5" /> דחה
            </Button>
            <Button
              size="sm"
              onClick={() => {
                verifyProviderLicense(provider.id);
                showToast("הרישיון אומת — הספק עבר לשלב האונבורדינג", { variant: "success" });
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> אמת רישיון
            </Button>
          </>
        )}
        {provider.status === "onboarding" && (
          <>
            <Button variant="outline" size="sm" onClick={() => onRequestChanges(provider)}>
              בקש תיקונים
            </Button>
            <Button variant="outline" size="sm" onClick={() => onRequestReject(provider)}>
              <Ban className="h-3.5 w-3.5" /> דחה
            </Button>
            <Button
              size="sm"
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
          </>
        )}
        {provider.status === "approved" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateProviderById(provider.id, { is_published: !provider.is_published });
                showToast(provider.is_published ? "הפרופיל הוסר מהפרסום" : "הפרופיל פורסם", { variant: "success" });
              }}
            >
              {provider.is_published ? "בטל פרסום" : "פרסם"}
            </Button>
            <Button
              variant="outline"
              size="sm"
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
            size="sm"
            onClick={() => {
              reinstateProvider(provider.id);
              showToast("הספק הופעל מחדש", { variant: "success" });
            }}
          >
            <PlayCircle className="h-3.5 w-3.5" /> הפעל מחדש
          </Button>
        )}
      </div>
    </div>
  );
}
