"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar, OpenDecisionNote } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { DOCTOR_SUBTYPE_LABELS, ProviderProfile, PROVIDER_STATUS_LABELS, PROVIDER_TYPE_LABELS } from "@/types";
import { formatDateHe } from "@/lib/utils";
import { ProviderForm, ProviderFormValues } from "@/components/admin/ProviderForm";
import { ProviderJourneyStepper } from "@/components/provider/ProviderJourneyStepper";
import { MonthlyReportSection } from "@/components/provider/MonthlyReportSection";
import { Plus, Search, BadgeCheck, Stethoscope, Ban, ShieldCheck, PauseCircle, PlayCircle, ClipboardList, Rocket, TriangleAlert } from "lucide-react";

export default function ProvidersPage() {
  const providers = useStore((s) => s.providers);
  const users = useStore((s) => s.users);
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const orders = useStore((s) => s.orders);
  const updateProviderById = useStore((s) => s.updateProviderById);
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const verifyProviderLicense = useStore((s) => s.verifyProviderLicense);
  const rejectProvider = useStore((s) => s.rejectProvider);
  const requestProviderChanges = useStore((s) => s.requestProviderChanges);
  const approveProviderGoLive = useStore((s) => s.approveProviderGoLive);
  const suspendProvider = useStore((s) => s.suspendProvider);
  const reinstateProvider = useStore((s) => s.reinstateProvider);
  const showToast = useStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<ProviderProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [changesTarget, setChangesTarget] = useState<ProviderProfile | null>(null);
  const [changesReason, setChangesReason] = useState("");
  const [reviewTarget, setReviewTarget] = useState<ProviderProfile | null>(null);
  const [providerFormOpen, setProviderFormOpen] = useState(false);

  function handleProviderSubmit(values: ProviderFormValues) {
    upsertProviderProfile(undefined, {
      provider_type: values.provider_type,
      display_name: values.display_name,
      specialty: values.specialty,
      contact_phone: values.contact_phone || undefined,
      contact_email: values.contact_email || undefined,
      license_number: values.license_number || undefined,
      commission_rate: values.commission_rate,
      status: "approved",
      is_published: true,
      license_verified_at: new Date().toISOString(),
    });
    showToast("הספק נוסף בהצלחה", { variant: "success" });
    setProviderFormOpen(false);
  }

  function handleVerifyLicense(p: ProviderProfile) {
    verifyProviderLicense(p.id);
    showToast("הרישיון אומת — הספק עבר לשלב האונבורדינג", {
      description: "הספק יכול כעת להמשיך להגדרת הסכם, הסדרים וקטלוג שירותים.",
      variant: "success",
    });
  }

  const filtered = useMemo(() => {
    return providers.filter((p) => {
      // A provider can now hold a live session from the moment they register
      // (PROV-REGISTRATION), before they've finished filling out / submitting
      // their application — Ops shouldn't see those half-finished signups.
      if (p.status === "pending_review" && !p.application_submitted_at) return false;
      if (statusFilter === "published" && !p.is_published) return false;
      if (statusFilter === "unpublished" && p.is_published) return false;
      if (statusFilter === "go_live_requested" && !(p.status === "onboarding" && p.go_live_requested_at)) return false;
      if (
        !["all", "published", "unpublished", "go_live_requested"].includes(statusFilter) &&
        p.status !== statusFilter
      )
        return false;
      if (!query) return true;
      return p.display_name.includes(query) || p.specialty.includes(query);
    });
  }, [providers, query, statusFilter]);

  return (
    <AppLayout>
      <PageHeader
        title="ספקי שירות"
        description="בדיקת רישיון, אונבורדינג, אישור Go-Live וניהול ספקי הבריאות במערכת"
        actions={
          <Button size="sm" onClick={() => setProviderFormOpen(true)}>
            <Plus className="h-4 w-4" /> ספק חדש
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <Input
          placeholder="חיפוש לפי שם או תחום..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
          <option value="all">כל הסטטוסים</option>
          <option value="pending_review">ממתינים לבדיקת רישיון</option>
          <option value="onboarding">באונבורדינג</option>
          <option value="go_live_requested">ביקשו פרסום — ממתינים לאישור</option>
          <option value="approved">מאושרים</option>
          <option value="rejected">נדחו</option>
          <option value="suspended">מושהים</option>
          <option value="published">מפורסמים</option>
          <option value="unpublished">לא מפורסמים</option>
        </Select>
      </div>

      <DataTable<ProviderProfile>
        rows={filtered}
        rowKey={(p) => p.id}
        emptyIcon={<Stethoscope className="h-10 w-10" />}
        emptyTitle="לא נמצאו ספקים"
        columns={
          [
            {
              key: "name",
              header: "ספק",
              sortable: true,
              sortValue: (p) => p.display_name,
              render: (p) => (
                <div className="flex items-center gap-3">
                  <Avatar name={p.display_name || "?"} />
                  <div>
                    <p className="font-medium text-slate-900">
                      {p.title} {p.display_name}
                    </p>
                    <p className="text-xs text-amber-700">{p.specialty || "—"}</p>
                  </div>
                </div>
              ),
            },
            {
              key: "status",
              header: "סטטוס",
              render: (p) => (
                <div className="flex gap-1.5 flex-wrap">
                  {p.status === "approved" ? (
                    <Badge tone="green">
                      <BadgeCheck className="h-3 w-3" /> מאושר
                    </Badge>
                  ) : p.status === "rejected" ? (
                    <Badge tone="red">נדחה</Badge>
                  ) : p.status === "suspended" ? (
                    <Badge tone="slate">מושהה</Badge>
                  ) : p.status === "onboarding" ? (
                    <Badge tone="blue">{PROVIDER_STATUS_LABELS[p.status]}</Badge>
                  ) : (
                    <Badge tone="amber">{PROVIDER_STATUS_LABELS[p.status]}</Badge>
                  )}
                  {p.is_published && <Badge tone="blue">מפורסם</Badge>}
                  {p.status === "onboarding" && p.go_live_requested_at ? (
                    <Badge tone="warning">⏳ ביקש פרסום — ממתין לאישור</Badge>
                  ) : (
                    p.status === "onboarding" &&
                    p.onboarding_ready_at && <Badge tone="green">מוכן, טרם ביקש פרסום</Badge>
                  )}
                </div>
              ),
            },
            {
              key: "agreements",
              header: "הסדרים",
              render: (p) => (
                <div className="flex flex-wrap gap-1 max-w-[220px]">
                  {p.agreements.length === 0 ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : (
                    <>
                      {(p.kupah_arrangements ?? []).map((a) => (
                        <Badge key={`${a.kupah}-${a.level}`} tone="slate">
                          {a.level}
                        </Badge>
                      ))}
                      {(p.private_insurance_companies ?? []).map((c) => (
                        <Badge key={c} tone="purple">
                          {c}
                        </Badge>
                      ))}
                      {(p.kupah_arrangements ?? []).length === 0 && (p.private_insurance_companies ?? []).length === 0 && (
                        <span className="text-xs text-slate-500">{p.agreements.map((a) => a.layer).join(", ")}</span>
                      )}
                    </>
                  )}
                </div>
              ),
            },
            {
              key: "commission",
              header: "עמלה",
              render: (p) => <span className="text-slate-700">{p.commission_rate ?? 15}%</span>,
            },
            {
              key: "clinics",
              header: "מרפאות",
              sortable: true,
              sortValue: (p) => p.clinic_locations.length,
              render: (p) => <span className="text-slate-700">{p.clinic_locations.length}</span>,
            },
            {
              key: "patients",
              header: "מטופלים",
              sortable: true,
              sortValue: (p) => patients.filter((pa) => pa.assigned_provider === p.id).length,
              render: (p) => (
                <span className="text-slate-700">{patients.filter((pa) => pa.assigned_provider === p.id).length}</span>
              ),
            },
            {
              key: "appointments",
              header: "תורים",
              sortable: true,
              sortValue: (p) => appointments.filter((a) => a.provider_id === p.id).length,
              render: (p) => (
                <span className="text-slate-700">{appointments.filter((a) => a.provider_id === p.id).length}</span>
              ),
            },
          ] satisfies DataTableColumn<ProviderProfile>[]
        }
        rowActions={(p) => (
          <>
            <Button variant="outline" size="sm" onClick={() => setReviewTarget(p)}>
              <ClipboardList className="h-3.5 w-3.5" /> פרטים
            </Button>
            {p.status === "pending_review" && (
              <Button variant="outline" size="sm" onClick={() => handleVerifyLicense(p)}>
                <ShieldCheck className="h-3.5 w-3.5" /> אמת רישיון
              </Button>
            )}
            {(p.status === "pending_review" || p.status === "onboarding") && (
              <Button variant="outline" size="sm" onClick={() => setRejectTarget(p)}>
                <Ban className="h-3.5 w-3.5" /> דחה
              </Button>
            )}
            {p.status === "approved" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateProviderById(p.id, { is_published: !p.is_published });
                    showToast(p.is_published ? "הפרופיל הוסר מהפרסום" : "הפרופיל פורסם", { variant: "success" });
                  }}
                >
                  {p.is_published ? "בטל פרסום" : "פרסם"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    suspendProvider(p.id);
                    showToast("הספק הושהה", { variant: "success" });
                  }}
                >
                  <PauseCircle className="h-3.5 w-3.5" /> השהה
                </Button>
              </>
            )}
            {p.status === "suspended" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  reinstateProvider(p.id);
                  showToast("הספק הופעל מחדש", { variant: "success" });
                }}
              >
                <PlayCircle className="h-3.5 w-3.5" /> הפעל מחדש
              </Button>
            )}
          </>
        )}
      />

      {/* Provider review — license/credential documents, and (once in onboarding) Phase C Go-Live decision */}
      <Dialog
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title="סקירת בקשת ספק"
        description={reviewTarget ? `${reviewTarget.title ?? ""} ${reviewTarget.display_name}` : undefined}
        className="max-w-2xl"
      >
        {reviewTarget && (
          <div className="flex flex-col gap-4">
            <ProviderJourneyStepper provider={reviewTarget} />

            {reviewTarget.doctor_subtype === "surgeon" && (
              <Badge tone="purple" className="self-start">
                {DOCTOR_SUBTYPE_LABELS.surgeon}
              </Badge>
            )}

            {/* Personal & professional details — always visible, any status (ADM-11: full record view) */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500 text-xs mb-1">איש קשר</p>
                <p className="font-medium text-slate-900">{reviewTarget.contact_name || reviewTarget.display_name}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500 text-xs mb-1">טלפון / אימייל</p>
                <p className="font-medium text-slate-900">
                  {reviewTarget.contact_phone || users.find((u) => u.id === reviewTarget.user_id)?.phone || "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {reviewTarget.contact_email || users.find((u) => u.id === reviewTarget.user_id)?.email || "—"}
                </p>
              </div>
              {reviewTarget.business_reg_number && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500 text-xs mb-1">מס&apos; עוסק/ח&quot;פ</p>
                  <p className="font-medium text-slate-900">{reviewTarget.business_reg_number}</p>
                </div>
              )}
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500 text-xs mb-1">עמלת Healson</p>
                <p className="font-medium text-slate-900">{reviewTarget.commission_rate ?? 15}%</p>
              </div>
              {(reviewTarget.sub_specialties?.length ?? 0) > 0 && (
                <div className="rounded-lg bg-slate-50 p-3 col-span-2">
                  <p className="text-slate-500 text-xs mb-1.5">תתי-התמחות</p>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewTarget.sub_specialties!.map((s) => (
                      <Badge key={s} tone="slate">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {(reviewTarget.service_areas?.length ?? 0) > 0 && (
                <div className="rounded-lg bg-slate-50 p-3 col-span-2">
                  <p className="text-slate-500 text-xs mb-1.5">אזורי שירות</p>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewTarget.service_areas!.map((s) => (
                      <Badge key={s} tone="slate">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {(reviewTarget.member_provider_types?.length ?? 0) > 0 && (
                <div className="rounded-lg bg-slate-50 p-3 col-span-2">
                  <p className="text-slate-500 text-xs mb-1.5">סוגי ספקים בארגון</p>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewTarget.member_provider_types!.map((t) => (
                      <Badge key={t} tone="slate">
                        {PROVIDER_TYPE_LABELS[t]}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {reviewTarget.bio && (
                <div className="rounded-lg bg-slate-50 p-3 col-span-2">
                  <p className="text-slate-500 text-xs mb-1">על אודות (bio)</p>
                  <p className="text-slate-800">{reviewTarget.bio}</p>
                </div>
              )}
              {reviewTarget.coordination_notes && (
                <div className="rounded-lg bg-slate-50 p-3 col-span-2">
                  <p className="text-slate-500 text-xs mb-1">הנחיות תיאום (פנימי, לא גלוי למטופלים)</p>
                  <p className="text-slate-800">{reviewTarget.coordination_notes}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500 text-xs mb-1">חתימת הסכם עם Healson</p>
                <p className="font-medium text-slate-900">
                  {reviewTarget.agreement_signed_at ? formatDateHe(reviewTarget.agreement_signed_at) : "טרם נחתם"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500 text-xs mb-1">בקשת פרסום (Go-Live)</p>
                <p className="font-medium text-slate-900">
                  {reviewTarget.go_live_requested_at ? formatDateHe(reviewTarget.go_live_requested_at) : "הספק טרם ביקש פרסום"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 col-span-2">
                <p className="text-slate-500 text-xs mb-1.5">הסדרי ביטוח</p>
                {reviewTarget.agreements.length === 0 ? (
                  <p className="font-medium text-slate-900">טרם הוגדרו</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(reviewTarget.kupah_arrangements ?? []).map((a) => (
                      <Badge key={`${a.kupah}-${a.level}`} tone="slate">
                        {a.level}
                      </Badge>
                    ))}
                    {(reviewTarget.private_insurance_companies ?? []).map((c) => (
                      <Badge key={c} tone="purple">
                        {c}
                      </Badge>
                    ))}
                    {(reviewTarget.kupah_arrangements ?? []).length === 0 &&
                      (reviewTarget.private_insurance_companies ?? []).length === 0 && (
                        <span className="font-medium text-slate-900">
                          {reviewTarget.agreements.map((a) => a.layer).join(", ")}
                        </span>
                      )}
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500 text-xs mb-1">יומנים</p>
                <p className="font-medium text-slate-900">{reviewTarget.clinic_locations.length} הוגדרו</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 col-span-2">
                <p className="text-slate-500 text-xs mb-1">קטלוג שירותים</p>
                <p className="font-medium text-slate-900">
                  {reviewTarget.consultation_types.length + reviewTarget.exam_types.length} פריטים
                </p>
                {(() => {
                  const allServices = [...reviewTarget.consultation_types, ...reviewTarget.exam_types];
                  const unlinked = allServices.filter((s) => (s.linked_clinic_ids?.length ?? 0) === 0).length;
                  return unlinked > 0 ? (
                    <p className="flex items-center gap-1 text-xs text-warning-text font-medium mt-1">
                      <TriangleAlert className="h-3 w-3" /> {unlinked} שירותים לא משויכים ליומן
                    </p>
                  ) : null;
                })()}
              </div>
            </div>

            {(reviewTarget.consultation_types.length > 0 || reviewTarget.exam_types.length > 0) && (
              <OpenDecisionNote>
                <b>טרם הוחלט:</b> מדיניות תמחור סופית — הספק קבע את המחירים הבאים בעצמו; טרם הוחלט האם Healson צריכה
                לאשר/להגביל את הטווח כחלק מסקירה זו.
              </OpenDecisionNote>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500 text-xs mb-1">קובץ רישיון</p>
                {reviewTarget.license_file ? (
                  <a
                    href={reviewTarget.license_file.data_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {reviewTarget.license_file.file_name}
                  </a>
                ) : (
                  <p className="font-medium text-slate-400">אין קובץ</p>
                )}
              </div>
              {reviewTarget.medical_resume_file && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500 text-xs mb-1">קורות חיים מקצועיים</p>
                  <a
                    href={reviewTarget.medical_resume_file.data_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {reviewTarget.medical_resume_file.file_name}
                  </a>
                </div>
              )}
              {reviewTarget.doctor_subtype === "surgeon" && (
                <>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500 text-xs mb-1">תעודת מומחה בתחום ניתוחי</p>
                    {reviewTarget.surgical_board_certificate ? (
                      <a
                        href={reviewTarget.surgical_board_certificate.data_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {reviewTarget.surgical_board_certificate.file_name}
                      </a>
                    ) : (
                      <p className="font-medium text-slate-400">אין קובץ</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500 text-xs mb-1">ביטוח אחריות מקצועית</p>
                    {reviewTarget.malpractice_insurance_file ? (
                      <a
                        href={reviewTarget.malpractice_insurance_file.data_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {reviewTarget.malpractice_insurance_file.file_name}
                      </a>
                    ) : (
                      <p className="font-medium text-slate-400">אין קובץ</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500 text-xs mb-1">הרשאת ניתוח</p>
                    <p className="font-medium text-slate-900">{reviewTarget.surgical_privileges_hospital || "—"}</p>
                  </div>
                </>
              )}
            </div>

            {reviewTarget.status === "approved" && (
              <MonthlyReportSection
                orders={orders.filter((o) => o.provider_id === reviewTarget.id)}
                providerName={reviewTarget.display_name}
              />
            )}

            {(reviewTarget.status === "pending_review" || reviewTarget.status === "onboarding") && (
              <div className="flex flex-wrap gap-2 justify-end">
                {reviewTarget.status === "onboarding" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setChangesTarget(reviewTarget);
                      setReviewTarget(null);
                    }}
                  >
                    בקש תיקונים
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRejectTarget(reviewTarget);
                    setReviewTarget(null);
                  }}
                >
                  דחה
                </Button>
                {reviewTarget.status === "pending_review" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      handleVerifyLicense(reviewTarget);
                      setReviewTarget(null);
                    }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> אמת רישיון
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={!reviewTarget.go_live_requested_at}
                    title={
                      !reviewTarget.onboarding_ready_at
                        ? "האונבורדינג טרם הושלם"
                        : !reviewTarget.go_live_requested_at
                        ? "הספק טרם ביקש פרסום"
                        : undefined
                    }
                    onClick={() => {
                      approveProviderGoLive(reviewTarget.id);
                      showToast("הספק אושר ל-Go-Live ופורסם", { variant: "success" });
                      setReviewTarget(null);
                    }}
                  >
                    <Rocket className="h-3.5 w-3.5" /> אשר Go-Live ופרסם
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="דחיית ספק"
        description={rejectTarget ? `${rejectTarget.title ?? ""} ${rejectTarget.display_name}` : undefined}
      >
        <div className="flex flex-col gap-3">
          <Textarea label="סיבת הדחייה" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required />
          <Button
            variant="destructive"
            onClick={() => {
              if (rejectTarget) {
                rejectProvider(rejectTarget.id, rejectReason);
                showToast("הספק נדחה", { variant: "success" });
              }
              setRejectTarget(null);
              setRejectReason("");
            }}
          >
            דחה ספק
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={!!changesTarget}
        onClose={() => setChangesTarget(null)}
        title="בקשת תיקונים מהספק"
        description={changesTarget ? `${changesTarget.title ?? ""} ${changesTarget.display_name}` : undefined}
      >
        <div className="flex flex-col gap-3">
          <Textarea label="מה יש לתקן?" value={changesReason} onChange={(e) => setChangesReason(e.target.value)} required />
          <Button
            onClick={() => {
              if (changesTarget) {
                requestProviderChanges(changesTarget.id, changesReason);
                showToast("נשלחה בקשת תיקונים לספק", { variant: "success" });
              }
              setChangesTarget(null);
              setChangesReason("");
            }}
          >
            שלח בקשת תיקונים
          </Button>
        </div>
      </Dialog>

      <ProviderForm open={providerFormOpen} onClose={() => setProviderFormOpen(false)} onSubmit={handleProviderSubmit} />
    </AppLayout>
  );
}
