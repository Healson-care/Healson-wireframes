"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { EmptyState } from "@/components/ui/Misc";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Input";
import { AdminProviderProfile } from "@/components/admin/AdminProviderProfile";
import { ProviderProfile } from "@/types";
import { ArrowRight, Stethoscope } from "lucide-react";

// Canned reasons for the reject / request-changes dialogs — one click fills
// the textarea, which stays editable so Ops can refine the wording.
const REJECT_REASON_PRESETS = [
  "קובץ הרישיון אינו קריא או חסר",
  "פרטי הרישיון אינם תואמים את הרישום במשרד הבריאות",
  "חסרים מסמכים נדרשים לסוג הספק",
  "תחום העיסוק אינו נתמך כרגע בפלטפורמה",
];

const CHANGES_REASON_PRESETS = [
  "יש להעלות קובץ רישיון עדכני וקריא",
  "יש להשלים את קטלוג השירותים והמחירים",
  "יש לשייך את כל השירותים למיקום פעיל",
  "יש להשלים פרטי מיקום ושעות פעילות",
];

function ReasonPresets({ presets, onPick }: { presets: string[]; onPick: (reason: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onPick(preset)}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
        >
          {preset}
        </button>
      ))}
    </div>
  );
}

export default function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const provider = useStore((s) => s.providers.find((p) => p.id === id));
  const rejectProvider = useStore((s) => s.rejectProvider);
  const requestProviderChanges = useStore((s) => s.requestProviderChanges);
  const showToast = useStore((s) => s.showToast);

  const [rejectTarget, setRejectTarget] = useState<ProviderProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectConfirmed, setRejectConfirmed] = useState(false);
  const [changesTarget, setChangesTarget] = useState<ProviderProfile | null>(null);
  const [changesReason, setChangesReason] = useState("");

  const backToList = () => router.push("/providers");

  if (!provider) {
    return (
      <AppLayout>
        <button onClick={backToList} className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowRight className="h-4 w-4" /> חזרה לניהול ספקים
        </button>
        <EmptyState
          icon={<Stethoscope className="h-10 w-10" />}
          title="הספק לא נמצא"
          description="ייתכן שהכרטיס נמחק או שהקישור אינו תקין."
          action={<Button onClick={backToList}>חזרה לרשימת הספקים</Button>}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <button onClick={backToList} className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowRight className="h-4 w-4" /> חזרה לניהול ספקים
      </button>

      <AdminProviderProfile
        providerId={provider.id}
        onClose={backToList}
        onRequestReject={(p) => {
          setRejectReason("");
          setRejectConfirmed(false);
          setRejectTarget(p);
        }}
        onRequestChanges={(p) => {
          setChangesReason("");
          setChangesTarget(p);
        }}
      />

      <Dialog
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
          setRejectConfirmed(false);
        }}
        title="דחיית ספק"
        description={rejectTarget ? `${rejectTarget.title ?? ""} ${rejectTarget.display_name}` : undefined}
      >
        <div className="flex flex-col gap-3">
          <ReasonPresets presets={REJECT_REASON_PRESETS} onPick={setRejectReason} />
          <Textarea label="סיבת הדחייה" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required />
          {rejectReason.trim() && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="mb-1 font-medium text-slate-500">כך זה יוצג לספק:</p>
              <p className="text-slate-800">בקשתך נדחתה: {rejectReason.trim()}</p>
            </div>
          )}
          <label className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger-text cursor-pointer">
            <input
              type="checkbox"
              checked={rejectConfirmed}
              onChange={(e) => setRejectConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#dc2626]"
            />
            אני מבין/ה שדחייה היא סופית — הספק ייחסם מכניסה למערכת ויקבל את הסיבה שלמעלה
          </label>
          <Button
            variant="destructive"
            disabled={rejectReason.trim().length < 5 || !rejectConfirmed}
            title={rejectReason.trim().length < 5 ? "יש להזין סיבת דחייה (לפחות 5 תווים)" : !rejectConfirmed ? "יש לאשר את הדחייה" : undefined}
            onClick={() => {
              if (rejectTarget) {
                rejectProvider(rejectTarget.id, rejectReason.trim());
                showToast("הספק נדחה", { variant: "success" });
              }
              setRejectTarget(null);
              setRejectReason("");
              setRejectConfirmed(false);
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
          <ReasonPresets presets={CHANGES_REASON_PRESETS} onPick={setChangesReason} />
          <Textarea label="מה יש לתקן?" value={changesReason} onChange={(e) => setChangesReason(e.target.value)} required />
          {changesReason.trim() && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="mb-1 font-medium text-slate-500">כך זה יוצג לספק במסך האונבורדינג:</p>
              <p className="text-slate-800">נדרשים תיקונים: {changesReason.trim()}</p>
            </div>
          )}
          <Button
            disabled={changesReason.trim().length < 5}
            title={changesReason.trim().length < 5 ? "יש לפרט מה יש לתקן (לפחות 5 תווים)" : undefined}
            onClick={() => {
              if (changesTarget) {
                requestProviderChanges(changesTarget.id, changesReason.trim());
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
