"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui/Misc";
import { CardListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { PriceListEntry, PriceListSection } from "@/components/provider/PriceListSection";
import { ClinicsSection } from "@/components/provider/ClinicsSection";
import { ReferralFormsSection } from "@/components/provider/ReferralFormsSection";
import {
  LayoutDashboard,
  Shield,
  Stethoscope,
  FlaskConical,
  MapPin,
  FileText,
  CalendarDays,
  CreditCard,
  Users,
  CheckCircle2,
  BadgeCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DAY_LABELS } from "@/lib/medical-tree";

export default function ProviderDashboardPage() {
  const currentUser = useStore((s) => s.currentUser);
  const provider = useCurrentProvider();
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const orders = useStore((s) => s.orders);
  const patients = useStore((s) => s.patients);
  const showToast = useStore((s) => s.showToast);

  // Create an empty profile automatically the first time a provider logs in.
  useEffect(() => {
    if (currentUser && currentUser.role === "provider" && !provider) {
      upsertProviderProfile(currentUser.id, {
        display_name: currentUser.full_name,
        specialty: "",
      });
    }
  }, [currentUser, provider, upsertProviderProfile]);

  const [licenseForm, setLicenseForm] = useState({
    display_name: "",
    title: "",
    specialty: "",
    license_number: "",
    license_issuer: "",
  });

  const [licenseLoadedFor, setLicenseLoadedFor] = useState<string | null>(null);
  if (provider && provider.id !== licenseLoadedFor) {
    setLicenseLoadedFor(provider.id);
    setLicenseForm({
      display_name: provider.display_name ?? "",
      title: provider.title ?? "",
      specialty: provider.specialty ?? "",
      license_number: provider.license_number ?? "",
      license_issuer: provider.license_issuer ?? "",
    });
  }

  if (!provider || !currentUser) {
    return (
      <ProviderLayout>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <CardListSkeleton count={3} />
        </div>
      </ProviderLayout>
    );
  }

  const isVerified = !!(provider.license_number && provider.display_name && provider.specialty);
  const myPatients = patients.filter((p) => p.assigned_provider === provider.id);
  const myOrders = orders.filter((o) => o.provider_id === provider.id);
  const completedRevenue = myOrders
    .filter((o) => o.status === "הושלם")
    .reduce((sum, o) => sum + o.final_price, 0);

  function saveLicense(e: React.FormEvent) {
    e.preventDefault();
    upsertProviderProfile(currentUser!.id, licenseForm);
    showToast("פרטי הרישיון נשמרו בהצלחה", { variant: "success" });
  }

  return (
    <ProviderLayout>
      <PageHeader
        title="לוח הבקרה שלי"
        description="ניהול הפרופיל המקצועי, שירותים ופעילות שוטפת"
        actions={
          <Button
            variant={provider.is_published ? "outline" : "primary"}
            onClick={() => {
              upsertProviderProfile(currentUser!.id, { is_published: !provider.is_published });
              showToast(provider.is_published ? "הפרופיל הוסר מהפרסום" : "הפרופיל פורסם בהצלחה", {
                variant: "success",
              });
            }}
          >
            {provider.is_published ? "בטל פרסום" : "פרסם פרופיל"}
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar name={provider.display_name || currentUser.full_name} className="h-14 w-14 text-lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-slate-900">
                {provider.title} {provider.display_name}
              </h2>
              {isVerified ? (
                <Badge tone="green">
                  <BadgeCheck className="h-3 w-3" /> מאומת
                </Badge>
              ) : (
                <Badge tone="amber">השלם פרופיל</Badge>
              )}
              {provider.is_published && <Badge tone="blue">פעיל</Badge>}
            </div>
            <p className="text-sm text-amber-700 font-medium mt-0.5">{provider.specialty || "—"}</p>
            {provider.license_number && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">{provider.license_number}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{provider.consultation_types.length}</p>
              <p className="text-xs text-slate-500">ייעוצים</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{provider.clinic_locations.length}</p>
              <p className="text-xs text-slate-500">מרפאות</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{provider.exam_types.length}</p>
              <p className="text-xs text-slate-500">בדיקות</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview" icon={<LayoutDashboard className="h-3.5 w-3.5" />}>סקירה</TabsTrigger>
          <TabsTrigger value="license" icon={<Shield className="h-3.5 w-3.5" />}>רישיון</TabsTrigger>
          <TabsTrigger value="consultations" icon={<Stethoscope className="h-3.5 w-3.5" />}>ייעוצים</TabsTrigger>
          <TabsTrigger value="exams" icon={<FlaskConical className="h-3.5 w-3.5" />}>בדיקות</TabsTrigger>
          <TabsTrigger value="clinics" icon={<MapPin className="h-3.5 w-3.5" />}>מרפאות</TabsTrigger>
          <TabsTrigger value="forms" icon={<FileText className="h-3.5 w-3.5" />}>תבניות הפניה</TabsTrigger>
          <TabsTrigger value="schedule" icon={<CalendarDays className="h-3.5 w-3.5" />}>זמינות</TabsTrigger>
          <TabsTrigger value="payments" icon={<CreditCard className="h-3.5 w-3.5" />}>תשלומים</TabsTrigger>
          <TabsTrigger value="crm" icon={<Users className="h-3.5 w-3.5" />}>CRM</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <StatCard label="מטופלים" value={myPatients.length} icon={<Users className="h-4 w-4" />} tone="blue" />
            <StatCard
              label="סטטוס פרופיל"
              value={isVerified ? "מאומת" : "לא הושלם"}
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone={isVerified ? "green" : "amber"}
            />
            <StatCard
              label="הכנסות (הושלם)"
              value={formatCurrency(completedRevenue)}
              icon={<CreditCard className="h-4 w-4" />}
              tone="purple"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>השלמת הפרופיל</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 flex flex-col gap-2">
              <ChecklistItem ok={!!provider.license_number} label="מספר רישיון" />
              <ChecklistItem ok={!!provider.specialty} label="תחום התמחות" />
              <ChecklistItem ok={provider.consultation_types.length > 0} label="לפחות סוג ייעוץ אחד" />
              <ChecklistItem ok={provider.clinic_locations.length > 0} label="לפחות מרפאה אחת" />
              <ChecklistItem ok={provider.is_published} label="פרופיל פורסם" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="license">
          <Card>
            <CardHeader>
              <CardTitle>פרטי רישיון</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveLicense} className="grid sm:grid-cols-2 gap-3">
                <Select
                  label="תואר"
                  value={licenseForm.title}
                  onChange={(e) => setLicenseForm({ ...licenseForm, title: e.target.value })}
                >
                  <option value="">בחר</option>
                  <option value='ד"ר'>{'ד"ר'}</option>
                  <option value="פרופ'">{"פרופ'"}</option>
                  <option value="מר/גב'">{"מר/גב'"}</option>
                </Select>
                <Input
                  label="שם תצוגה"
                  value={licenseForm.display_name}
                  onChange={(e) => setLicenseForm({ ...licenseForm, display_name: e.target.value })}
                  required
                />
                <Input
                  label="תחום התמחות"
                  value={licenseForm.specialty}
                  onChange={(e) => setLicenseForm({ ...licenseForm, specialty: e.target.value })}
                  required
                />
                <Input
                  label="מספר רישיון"
                  value={licenseForm.license_number}
                  onChange={(e) => setLicenseForm({ ...licenseForm, license_number: e.target.value })}
                  required
                />
                <Input
                  label="גוף מנפיק"
                  value={licenseForm.license_issuer}
                  onChange={(e) => setLicenseForm({ ...licenseForm, license_issuer: e.target.value })}
                />
                <Button type="submit" className="sm:col-span-2 self-start mt-2">
                  שמור פרטי רישיון
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consultations">
          <PriceListSection
            items={provider.consultation_types as unknown as PriceListEntry[]}
            onChange={(items) => upsertProviderProfile(currentUser!.id, { consultation_types: items as unknown as typeof provider.consultation_types })}
            extraFieldKey="duration_minutes"
            extraFieldLabel="משך (דקות)"
            extraFieldType="number"
            itemLabel="ייעוץ"
          />
        </TabsContent>

        <TabsContent value="exams">
          <PriceListSection
            items={provider.exam_types as unknown as PriceListEntry[]}
            onChange={(items) => upsertProviderProfile(currentUser!.id, { exam_types: items as unknown as typeof provider.exam_types })}
            extraFieldKey="lab_code"
            extraFieldLabel="קוד מעבדה"
            extraFieldType="text"
            itemLabel="בדיקה"
          />
        </TabsContent>

        <TabsContent value="clinics">
          <ClinicsSection
            clinics={provider.clinic_locations}
            onChange={(clinics) => upsertProviderProfile(currentUser!.id, { clinic_locations: clinics })}
          />
        </TabsContent>

        <TabsContent value="forms">
          <ReferralFormsSection
            forms={provider.referral_forms}
            onChange={(forms) => upsertProviderProfile(currentUser!.id, { referral_forms: forms })}
          />
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>זמינות שבועית</CardTitle>
              <p className="text-sm text-slate-500">מבוסס על שעות הפעילות של המרפאה הראשית</p>
            </CardHeader>
            <CardContent>
              {provider.clinic_locations.length === 0 ? (
                <EmptyState title="הגדר מרפאה כדי לראות זמינות" />
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {Object.entries(provider.clinic_locations.find((c) => c.is_primary)?.hours ?? {}).map(
                    ([day, range]) => (
                      <div key={day} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-slate-600">{DAY_LABELS[day]}</span>
                        <span className="font-medium text-slate-800">
                          {range ? `${range[0]} - ${range[1]}` : "סגור"}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <StatCard label="הכנסה כוללת" value={formatCurrency(completedRevenue)} tone="green" />
            <StatCard label="עסקאות שהושלמו" value={myOrders.filter((o) => o.status === "הושלם").length} tone="blue" />
            <StatCard label="עסקאות בתהליך" value={myOrders.filter((o) => o.status !== "הושלם" && o.status !== "בוטל").length} tone="amber" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>עסקאות אחרונות</CardTitle>
            </CardHeader>
            <CardContent>
              {myOrders.length === 0 ? (
                <EmptyState title="אין עסקאות עדיין" />
              ) : (
                <div className="flex flex-col gap-2">
                  {myOrders.slice(0, 10).map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-700">{o.patient_name} · {o.item_name}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(o.final_price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crm">
          {myPatients.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" />} title="אין מטופלים משויכים" />
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {myPatients.slice(0, 5).map((p) => (
                      <Avatar key={p.id} name={p.full_name} className="ring-2 ring-white" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">{myPatients.length}</span> מטופלים משויכים אליך
                  </p>
                </div>
                <Link href="/provider/patients">
                  <Button variant="outline" size="sm">
                    לרשימת המטופלים המלאה
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </ProviderLayout>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className={`h-4 w-4 ${ok ? "text-emerald-500" : "text-slate-300"}`} />
      <span className={ok ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </div>
  );
}
