"use client";

import { useRouter } from "next/navigation";
import { BellRing, Calendar, Clock, Users } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { ProviderProfile } from "@/types";

export function WaitlistJoinDialog({
  provider,
  slot,
  onClose,
  clientName,
  clientPhone,
  createdById,
}: {
  provider: ProviderProfile | null;
  // A slot with no date/time is a general "any time works" request rather
  // than one tied to a specific taken slot.
  slot: { date?: string; time?: string; label?: string } | null;
  onClose: () => void;
  clientName: string;
  clientPhone?: string;
  createdById?: string;
}) {
  const waitlist = useStore((s) => s.waitlist);
  const addWaitlistEntry = useStore((s) => s.addWaitlistEntry);
  const showToast = useStore((s) => s.showToast);
  const router = useRouter();

  const isGeneral = !!slot && !slot.date;

  const aheadInQueue =
    provider && slot
      ? waitlist.filter(
          (w) =>
            w.provider_id === provider.id &&
            w.status === "ממתין" &&
            (isGeneral ? !w.date && !w.time : w.date === slot.date && w.time === slot.time)
        ).length
      : 0;

  return (
    <Dialog open={!!slot && !!provider} onClose={onClose} title="הצטרפות לרשימת המתנה">
      {slot && provider && (
        <>
          <div className="flex flex-col items-center gap-3 text-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BellRing className="h-7 w-7" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {provider.title} {provider.display_name}
              </p>
              {isGeneral ? (
                <p className="text-sm text-slate-500 mt-1">כל מועד פנוי — נציע לכם את התור הראשון שיתפנה</p>
              ) : (
                <p className="flex items-center justify-center gap-3 text-sm text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> {slot.label}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {slot.time}
                  </span>
                </p>
              )}
            </div>
          </div>

          {aheadInQueue > 0 && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-text mb-4">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {aheadInQueue} כבר {isGeneral ? "ברשימת ההמתנה הכללית" : "ברשימת ההמתנה למועד הזה"} — תהיו במקום{" "}
              {aheadInQueue + 1}
            </div>
          )}

          <p className="text-sm text-slate-500 text-center leading-relaxed mb-5">
            {isGeneral
              ? "נעדכן אתכם ברגע שיתפנה תור כלשהו אצל הרופא/ה — ללא עלות וללא התחייבות."
              : "נעדכן אתכם מיד אם יתפנה מקום במועד הזה — ללא עלות וללא התחייבות."}
          </p>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50"
            >
              ביטול
            </button>
            <Button
              onClick={() => {
                addWaitlistEntry({
                  provider_id: provider.id,
                  provider_name: `${provider.title ?? ""} ${provider.display_name}`.trim(),
                  client_name: clientName,
                  client_phone: clientPhone,
                  date: slot.date,
                  time: slot.time,
                  created_by_id: createdById,
                });
                showToast("נרשמת לרשימת ההמתנה", {
                  description: "ניצור איתך קשר אם יתפנה תור מתאים",
                  variant: "success",
                });
                onClose();
                router.push("/client/appointments");
              }}
            >
              <BellRing className="h-4 w-4" /> הצטרפות לרשימת ההמתנה
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
