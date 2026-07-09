"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { DOCTOR_SUBTYPE_LABELS, ProviderProfile, PROVIDER_STATUS_LABELS } from "@/types";
import { formatDateHe } from "@/lib/utils";
import { Search, BadgeCheck, Stethoscope, Ban, ShieldCheck, PauseCircle, PlayCircle, ClipboardList } from "lucide-react";

export default function ProvidersPage() {
  const providers = useStore((s) => s.providers);
  const users = useStore((s) => s.users);
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const updateProviderById = useStore((s) => s.updateProviderById);
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

  function handleVerifyLicense(p: ProviderProfile) {
    const tempPassword = verifyProviderLicense(p.id);
    const user = users.find((u) => u.id === p.user_id);
    showToast("הרישיון אומת — הספק עבר לשלב האונבורדינג", {
      description: user
        ? `נשלחו לספק פרטי התחברות ל-${user.email} (סיסמה זמנית להדגמה: ${tempPassword})`
        : undefined,
      variant: "success",
    });
  }

  const filtered = useMemo(() => {
    return providers.filter((p) => {
      if (statusFilter === "published" && !p.is_published) return false;
      if (statusFilter === "unpublished" && p.is_published) return false;
      if (!["all", "published", "unpublished"].includes(statusFilter) && p.status !== statusFilter) return false;
      if (!query) return true;
      return p.display_name.includes(query) || p.specialty.includes(query);
    });
  }, [providers, query, statusFilter]);

  return (
    <AppLayout>
      <PageHeader title="ספקי שירות" description="בדיקת רישיון, אונבורדינג, אישור Go-Live וניהול ספקי הבריאות במערכת" />

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
                  {p.status === "onboarding" && p.onboarding_ready_at && (
                    <Badge tone="green">מוכן ל-Go-Live</Badge>
                  )}
                </div>
              ),
            },
            {
              key: "agreements",
              header: "הסדרים",
              render: (p) => (
                <span className="text-xs text-slate-500">
                  {p.agreements.length > 0 ? p.agreements.map((a) => a.layer).join(", ") : "—"}
                </span>
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
            {(p.status === "pending_review" || p.status === "onboarding") && (
              <Button variant="outline" size="sm" onClick={() => setReviewTarget(p)}>
                <ClipboardList className="h-3.5 w-3.5" /> פרטים
              </Button>
            )}
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
      >
        {reviewTarget && (
          <div className="flex flex-col gap-4">
            {reviewTarget.doctor_subtype === "surgeon" && (
              <Badge tone="purple" className="self-start">
                {DOCTOR_SUBTYPE_LABELS.surgeon}
              </Badge>
            )}

            {reviewTarget.status === "onboarding" && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500 text-xs mb-1">הסדרי ביטוח</p>
                  <p className="font-medium text-slate-900">
                    {reviewTarget.agreements.length > 0 ? reviewTarget.agreements.map((a) => a.layer).join(", ") : "טרם הוגדרו"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500 text-xs mb-1">קטלוג שירותים</p>
                  <p className="font-medium text-slate-900">
                    {reviewTarget.consultation_types.length + reviewTarget.exam_types.length} פריטים
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500 text-xs mb-1">חתימת הסכם</p>
                  <p className="font-medium text-slate-900">
                    {reviewTarget.agreement_signed_at ? formatDateHe(reviewTarget.agreement_signed_at) : "טרם נחתם"}
                  </p>
                </div>
              </div>
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
                  disabled={!reviewTarget.onboarding_ready_at}
                  title={!reviewTarget.onboarding_ready_at ? "האונבורדינג טרם הושלם" : undefined}
                  onClick={() => {
                    approveProviderGoLive(reviewTarget.id);
                    showToast("הספק אושר ל-Go-Live", { variant: "success" });
                    setReviewTarget(null);
                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> אשר Go-Live
                </Button>
              )}
            </div>
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
    </AppLayout>
  );
}
