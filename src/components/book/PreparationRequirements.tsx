import { AlertCircle } from "lucide-react";
import { ANESTHESIA_TYPE_LABELS, ConsultationType } from "@/types";

/** Turns a ConsultationType's scattered prep/logistics fields (set by the
 * provider in ServiceCatalogSection — requires_fasting, anesthesia_type,
 * etc.) into patient-facing instructions. These fields already exist on the
 * type and are shown to the provider as badges, but were never surfaced to
 * the patient anywhere in the booking flow. */
function buildPreparationItems(consultation: ConsultationType): string[] {
  const items: string[] = [];
  if (consultation.requires_referral) items.push("יש להגיע עם הפניה תקפה מקופת החולים");
  if (consultation.requires_fasting) items.push("יש להגיע בצום (לא לאכול/לשתות לפני הבדיקה)");
  if (consultation.requires_contrast) items.push("הבדיקה כוללת הזרקת חומר ניגוד");
  if (consultation.has_radiation) items.push("הבדיקה כרוכה בחשיפה לקרינה מייננת");
  if (consultation.anesthesia_type) {
    items.push(`הטיפול מתבצע בהרדמה ${ANESTHESIA_TYPE_LABELS[consultation.anesthesia_type]}`);
  }
  if (consultation.requires_hospital) items.push("הטיפול מצריך אשפוז");
  if (consultation.recovery_days) items.push(`זמן החלמה משוער: ${consultation.recovery_days} ימים`);
  return items;
}

export function PreparationRequirements({ consultation }: { consultation?: ConsultationType }) {
  if (!consultation) return null;
  const items = buildPreparationItems(consultation);
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning-border bg-warning-bg p-3 text-right">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-text mb-1.5">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> דרישות מקדימות לתור
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((text) => (
          <li key={text} className="text-xs text-warning-text/80">
            • {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
