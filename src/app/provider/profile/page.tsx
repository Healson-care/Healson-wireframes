"use client";

import { useState } from "react";
import Link from "next/link";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { generateId } from "@/lib/utils";
import type { Clinic, ProviderProfile } from "@/types";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { Card, CardContent } from "@/components/ui/Card";
import { ProviderStatusBadge, ProviderPublishedBadge } from "@/components/ui/Badge";
import { Avatar, SectionHeading } from "@/components/ui/Misc";
import { ProgressRing } from "@/components/ui/Progress";
import { CardListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { getProfileSections } from "@/components/provider/profile-sections";
import {
  getProviderSetupConfig,
  isCatalogComplete,
  isLocationsComplete,
  isAvailabilityComplete,
} from "@/lib/provider-setup";
import { Star, CheckCircle2, ChevronLeft, MapPinned, Network, Pencil } from "lucide-react";

const EMPTY_CLINIC_HOURS: Clinic["hours"] = {
  sunday: null,
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: null,
  friday: null,
  saturday: null,
};

export default function ProviderProfileOverviewPage() {
  const currentUser = useStore((s) => s.currentUser);
  const provider = useCurrentProvider();
  const affiliations = useStore((s) => s.affiliations);
  const providers = useStore((s) => s.providers);
  const parentOrganization = provider?.parent_organization_id
    ? providers.find((p) => p.id === provider.parent_organization_id)
    : undefined;

  if (!provider || !currentUser) {
    return (
      <ProviderLayout>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <CardListSkeleton count={2} />
        </div>
      </ProviderLayout>
    );
  }

  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const sections = getProfileSections(setupConfig).filter((s) => s.key !== "overview");
  const inheritsArrangements =
    provider.clinic_locations.length === 0 &&
    affiliations.some(
      (a) => a.provider_id === provider.id && (a.status === "active" || a.status === "unclaimed")
    );

  const isVerified = provider.status === "approved";
  const checklist: { ok: boolean; label: string }[] = [
    { ok: !!provider.license_number, label: "מספר רישיון" },
    { ok: !!provider.specialty, label: "תחום התמחות" },
    // A provider who works only inside units inherits their arrangements
    // (payments meeting §5) — the line would otherwise sit unchecked forever.
    ...(setupConfig.showAgreements && !inheritsArrangements
      ? [{ ok: provider.agreements.length > 0, label: "הסדרי ביטוח (S/K/B/H)" }]
      : []),
    { ok: isCatalogComplete(provider), label: setupConfig.catalogLabel },
    ...(setupConfig.locationTypes.length > 0
      ? [{ ok: isLocationsComplete(provider), label: setupConfig.locationLabelPlural }]
      : []),
    ...(setupConfig.showAvailability ? [{ ok: isAvailabilityComplete(provider), label: "זמינות שבועית" }] : []),
    { ok: !!provider.image_url, label: "תמונת פרופיל · מומלץ" },
    { ok: isVerified, label: "אישור Healson" },
    { ok: provider.is_published, label: "פרסום פרופיל" },
  ];
  const percent = Math.round((checklist.filter((i) => i.ok).length / checklist.length) * 100);

  return (
    <ProviderLayout>
      {/* Identity hero */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-neutral-border bg-gradient-to-l from-white via-white to-accent-bg/40 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar
            name={provider.display_name || currentUser.full_name}
            src={provider.image_url}
            className="h-16 w-16 text-xl ring-4 ring-white shadow-md"
          />
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {provider.title} {provider.display_name}
              </h1>
              <ProviderStatusBadge
                status={provider.status}
                title={provider.status === "rejected" ? provider.rejection_reason : undefined}
              />
              {provider.is_published && <ProviderPublishedBadge />}
            </div>
            {/* A medical unit is never a standalone business — it operates under
                an organization, and that is identity, not a setting: name it
                right under the unit's own name so it can't be missed. */}
            {parentOrganization && (
              <p className="mt-1 flex items-center gap-1.5 text-sm">
                <Network className="h-3.5 w-3.5 text-primary" />
                <span className="text-slate-500">יחידה רפואית תחת</span>
                <span className="font-semibold text-slate-900">{parentOrganization.display_name}</span>
              </p>
            )}
            <p className="mt-0.5 text-sm font-medium text-amber-700">{provider.specialty || "—"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {provider.license_number && <p className="text-xs text-slate-400 font-mono">{provider.license_number}</p>}
              {!!provider.rating && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {provider.rating.toFixed(1)} ({provider.review_count ?? 0} ביקורות)
                </span>
              )}
            </div>
          </div>
          <ProgressRing
            percent={percent}
            tone={percent === 100 ? "success" : "primary"}
            label="פרופיל"
            textClassName="text-slate-900"
          />
        </div>
      </div>

      {/* Completion checklist */}
      {percent < 100 && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <SectionHeading>השלמת הפרופיל</SectionHeading>
            <div className="grid gap-2 sm:grid-cols-2">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`h-4 w-4 ${item.ok ? "text-emerald-500" : "text-slate-300"}`} />
                  <span className={item.ok ? "text-slate-700" : "text-slate-400"}>{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* פרטי היחידה — a medical unit has exactly ONE address and it is
          identity, not configuration, so it lives here rather than as its own
          nav entry (which used to be labelled "פרטי היחידה" and sat oddly
          alongside סניפים, implying the unit had two location concepts). */}
      {setupConfig.singleLocation && <UnitDetailsCard provider={provider} />}

      {/* Section cards — navigate to each configuration page */}
      <SectionHeading>ניהול הפרופיל</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{s.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
            </div>
            <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
          </Link>
        ))}
      </div>
    </ProviderLayout>
  );
}

/** The unit's single address + contact details, edited in place. */
function UnitDetailsCard({ provider }: { provider: ProviderProfile }) {
  const updateProviderById = useStore((s) => s.updateProviderById);
  const showToast = useStore((s) => s.showToast);
  const existing = provider.clinic_locations[0];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    address: existing?.address ?? "",
    city: existing?.city ?? "",
    phone: existing?.phone ?? "",
  });

  function save() {
    const next: Clinic = {
      ...existing,
      id: existing?.id ?? generateId("clinic"),
      // A unit's site carries the unit's own name — never a second one.
      name: provider.display_name,
      address: form.address,
      city: form.city,
      phone: form.phone,
      is_primary: true,
      hours: existing?.hours ?? EMPTY_CLINIC_HOURS,
      location_type: "clinic",
    };
    updateProviderById(provider.id, {
      clinic_locations: [next, ...provider.clinic_locations.slice(1)],
    });
    showToast("פרטי היחידה נשמרו", { variant: "success" });
    setOpen(false);
  }

  const filled = !!existing?.address || !!existing?.city;

  return (
    <>
      <SectionHeading>פרטי היחידה</SectionHeading>
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPinned className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{provider.display_name}</p>
              {filled ? (
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {[existing?.city, existing?.address].filter(Boolean).join(", ")}
                  {existing?.phone && (
                    <>
                      <br />
                      {existing.phone}
                    </>
                  )}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-warning-text">טרם הוגדרה כתובת ליחידה</p>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> {filled ? "עריכה" : "הגדרת פרטים"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="פרטי היחידה">
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-slate-500">
            הכתובת הראשית של היחידה. את האתרים הפיזיים שבהם היא פועלת מגדירים בלשונית ‚סניפים‘.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="עיר" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="כתובת" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <Input label="טלפון" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button onClick={save}>שמור פרטי יחידה</Button>
        </div>
      </Dialog>
    </>
  );
}
