"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { useStore } from "@/lib/store";
import {
  AFFILIATION_STATUS_LABELS,
  DayKey,
  ProviderProfile,
  WeeklySchedule,
  isPractitionerProviderType,
  isUnitProviderType,
} from "@/types";
import { resolveResourceSchedule } from "@/lib/unit-resources";
import { Building2, Check, Link2, Lock, Search, X } from "lucide-react";

const DAY_LABELS: Record<DayKey, string> = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת",
};
const DAY_ORDER: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** The unit-entered weekly schedule, read-only — the provider views it here but
 * only the unit can change it (§PRV-10). */
function ReadOnlySchedule({ schedule }: { schedule?: WeeklySchedule }) {
  const days = DAY_ORDER.filter((d) => (schedule?.[d]?.length ?? 0) > 0);
  if (days.length === 0) {
    return <p className="text-[11px] text-slate-400">היחידה טרם הזינה לך לו״ז.</p>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {days.map((d) => (
        <div key={d} className="flex items-baseline gap-2 text-[11px]">
          <span className="w-10 shrink-0 font-medium text-slate-600">{DAY_LABELS[d]}</span>
          <span className="text-slate-500">
            {schedule![d].map((s) => `${s.start}–${s.end}`).join(" · ")}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Provider-side of the bidirectional affiliation (§PRV-10): the doctor/nurse
 * sees units that invited them (accept/decline), the units they already work in
 * (read-only — the unit owns their in-unit schedule), and can request to join a
 * unit themselves. Only rendered for human provider types. */
export function ProviderUnitsCard({ provider }: { provider: ProviderProfile }) {
  const affiliationsAll = useStore((s) => s.affiliations);
  const providers = useStore((s) => s.providers);
  const acceptAffiliation = useStore((s) => s.acceptAffiliation);
  const declineAffiliation = useStore((s) => s.declineAffiliation);
  const requestUnitAffiliation = useStore((s) => s.requestUnitAffiliation);
  const showToast = useStore((s) => s.showToast);
  const [joinOpen, setJoinOpen] = useState(false);

  const mine = useMemo(
    () =>
      affiliationsAll.filter(
        (a) => a.provider_id === provider.id && a.status !== "ended" && a.status !== "declined"
      ),
    [affiliationsAll, provider.id]
  );
  const unitById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);

  // Only a single human's time is scheduled against a unit, so entity providers
  // (store/pharmacy/lab/…) never affiliate — hide the card for them. A provider
  // that already HAS an affiliation always sees it, even if provider_type is a
  // legacy blank (older seed doctors), so the card never silently disappears.
  if (!isPractitionerProviderType(provider.provider_type) && mine.length === 0) return null;

  const invites = mine.filter((a) => a.status === "invited_by_unit");
  const rest = mine.filter((a) => a.status !== "invited_by_unit");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-slate-400" /> יחידות רפואיות
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)}>
          <Link2 className="h-3.5 w-3.5" /> הצטרפות ליחידה
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-slate-500">
          מעבר למרפאות הפרטיות שלך, אפשר להשתייך ליחידה רפואית (מרפאות חוץ / מכון). חפשו את היחידה, שלחו בקשת
          הצטרפות, ולאחר אישורה — הלו״ז שהיחידה מזינה לך יוצג כאן לצפייה בלבד.
        </p>
        {invites.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-info-text">הזמנות ממתינות לאישורך</p>
            {invites.map((a) => {
              const unit = unitById.get(a.unit_id);
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{unit?.display_name ?? "יחידה"}</p>
                    <p className="truncate text-[11px] text-slate-500">{a.role ?? "נותן/ת שירות"}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const r = acceptAffiliation(a.id);
                      showToast(r.ok ? "הצטרפת ליחידה" : r.error ?? "שגיאה", {
                        variant: r.ok ? "success" : "destructive",
                      });
                    }}
                  >
                    <Check className="h-3.5 w-3.5" /> אשר
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const r = declineAffiliation(a.id);
                      showToast(r.ok ? "ההזמנה נדחתה" : r.error ?? "שגיאה", {
                        variant: r.ok ? "success" : "destructive",
                      });
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> דחה
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {rest.length === 0 && invites.length === 0 ? (
          <EmptyState
            title="אינך משויך/ת ליחידה רפואית"
            description="אפשר להצטרף ליחידה קיימת — היומן שלך יציג את שיבוצי היחידה לצד המרפאות הפרטיות שלך."
          />
        ) : (
          rest.map((a) => {
            const unit = unitById.get(a.unit_id);
            const schedules = new Map((unit?.resource_schedules ?? []).map((s) => [s.id, s]));
            const resolved = resolveResourceSchedule(a, schedules);
            return (
              <div key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{unit?.display_name ?? "יחידה"}</p>
                    {a.role && <p className="truncate text-xs text-slate-500">{a.role}</p>}
                  </div>
                  <Badge tone={a.status === "active" || a.status === "unclaimed" ? "success" : "slate"}>
                    {AFFILIATION_STATUS_LABELS[a.status]}
                  </Badge>
                </div>
                <div className="mt-2 rounded-md border border-slate-200 bg-white p-2.5">
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Lock className="h-3 w-3" /> הלו״ז שהיחידה הזינה לך — לצפייה בלבד
                  </p>
                  <ReadOnlySchedule schedule={resolved.schedule} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <JoinUnitDialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        units={providers.filter((p) => isUnitProviderType(p.provider_type) && p.status === "approved")}
        excludeUnitIds={new Set(mine.map((a) => a.unit_id))}
        onRequest={(unitId) => {
          const r = requestUnitAffiliation(provider.id, unitId);
          if (!r.ok) {
            showToast(r.error ?? "שגיאה", { variant: "destructive" });
            return;
          }
          showToast("בקשת ההצטרפות נשלחה", {
            description: "השיוך יופעל לאחר אישור היחידה",
            variant: "success",
          });
          setJoinOpen(false);
        }}
      />
    </Card>
  );
}

function JoinUnitDialog({
  open,
  onClose,
  units,
  excludeUnitIds,
  onRequest,
}: {
  open: boolean;
  onClose: () => void;
  units: ProviderProfile[];
  excludeUnitIds: Set<string>;
  onRequest: (unitId: string) => void;
}) {
  const [q, setQ] = useState("");
  const results = units.filter(
    (u) => !excludeUnitIds.has(u.id) && (q.trim().length < 2 || u.display_name.includes(q.trim()))
  );
  return (
    <Dialog open={open} onClose={onClose} title="הצטרפות ליחידה רפואית" className="max-w-lg">
      <div className="flex flex-col gap-3">
        <Input
          label="חיפוש יחידה"
          icon={<Search className="h-4 w-4" />}
          placeholder="שם היחידה"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          hint="הבקשה תישלח ליחידה לאישור — השיוך אינו פעיל עד לאישורה"
        />
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-500">לא נמצאו יחידות תואמות</p>
          ) : (
            results.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"
              >
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{u.display_name}</p>
                  <p className="truncate text-[11px] text-slate-500">{u.specialty}</p>
                </div>
                <Button size="sm" onClick={() => onRequest(u.id)}>
                  <Link2 className="h-3.5 w-3.5" /> בקש הצטרפות
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}
