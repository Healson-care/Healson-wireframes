"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, MapPin, Phone, Receipt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ServiceItemCard } from "@/components/book/ServiceItemCard";
import { PreparationRequirements } from "@/components/book/PreparationRequirements";
import { useStore } from "@/lib/store";
import { providerLabel } from "@/lib/search";
import { ConsultationType, PROVIDER_SERVICE_TYPE_LABELS, ProviderProfile } from "@/types";

// Deterministic (not Math.random) so it stays pure during render — the
// spread still reads as organic confetti thanks to the sine-based offsets.
const CONFETTI_COLORS = ["#0d7d6f", "#c8973a", "#10b981", "#6366f1", "#ec4899"];
const CONFETTI_PIECES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: Math.sin(i * 2.4) * 110,
  y: 90 + ((i * 17) % 40),
  rotate: (i * 53) % 360,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: (i % 6) * 0.025,
}));

function ConfettiBurst() {
  return (
    <div className="relative h-0 w-full pointer-events-none">
      {CONFETTI_PIECES.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 left-1/2 h-2 w-2 rounded-sm"
          style={{ backgroundColor: p.color }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, rotate: p.rotate }}
          transition={{ duration: 1, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export function BookingConfirmation({
  provider,
  selectedSlot,
  confirmation,
  homeHref,
  homeLabel,
  appointmentId,
  bookedServiceName,
  consultation,
}: {
  provider: ProviderProfile;
  selectedSlot: { date: string; time: string; label: string };
  confirmation: { fileNumber: string; price: number; icsUrl: string };
  homeHref: string;
  homeLabel: string;
  appointmentId: string;
  // Excluded from "שירותים רלוונטיים נוספים" below so the doctor's own just-
  // booked service doesn't show up as a suggestion for themselves.
  bookedServiceName?: string;
  consultation?: ConsultationType;
}) {
  const documents = useStore((s) => s.documents);
  const appointments = useStore((s) => s.appointments);
  const showToast = useStore((s) => s.showToast);
  // Everything still waiting on the patient for this specific appointment —
  // the questionnaire (if any) plus any named required_documents checklist
  // items (see ConsultationType.required_documents), not just the
  // questionnaire alone.
  const pendingDocs = documents.filter((d) => d.appointment_id === appointmentId && d.status === "ממתין למילוי");
  const appointmentHref = `/client/appointments?appointment=${appointmentId}`;

  // Minimal doctor/location details right here — so most patients never
  // need to click through to the full appointment just to see where they're
  // going. "לצפייה בתור" below still exists for everything else (reschedule,
  // cancel, full document list).
  const bookedAppointment = appointments.find((a) => a.id === appointmentId);
  const clinic =
    provider.clinic_locations.find((c) => c.id === bookedAppointment?.clinic_id) ??
    provider.clinic_locations.find((c) => c.is_primary) ??
    provider.clinic_locations[0];

  // Placeholder cross-sell (§future: real recommendations based on the
  // service just booked) — for now, surfaces this doctor's other services
  // as "you might also need" so the concept/UI exists ahead of that logic.
  const otherServices = provider.consultation_types.filter((ct) => ct.name !== bookedServiceName).slice(0, 3);

  return (
    <div className="max-w-md mx-auto text-center">
      <ConfettiBurst />
      <motion.div
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
      >
        <CheckCircle2 className="h-9 w-9 text-emerald-600" />
      </motion.div>
      <h2 className="text-2xl font-bold text-slate-900">התור נקבע בהצלחה! 🎉</h2>
      <p className="text-slate-500 mt-2">
        {providerLabel(provider)} · {selectedSlot.label} בשעה {selectedSlot.time}
      </p>
      <p className="text-xs text-slate-400 mt-1">מספר תיק לקוח #{confirmation.fileNumber}</p>

      <div className="mt-4 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 text-right text-sm">
        <p className="font-bold text-slate-900">
          {providerLabel(provider)}
        </p>
        <p className="text-slate-500">{provider.specialty}</p>
        {clinic && (
          <p className="flex items-center gap-1.5 text-slate-500 mt-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {clinic.name} · {clinic.address}, {clinic.city}
          </p>
        )}
        {clinic?.phone && (
          <a href={`tel:${clinic.phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
            <Phone className="h-3.5 w-3.5 shrink-0" /> {clinic.phone}
          </a>
        )}
      </div>

      <div className="mt-3">
        <PreparationRequirements consultation={consultation} />
      </div>

      <div className="mt-3 flex flex-col items-stretch gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-right sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 shrink-0 text-slate-500" />
          <div>
            <p className="text-sm font-bold text-slate-900">הקבלה על המקדמה מוכנה</p>
            <p className="text-xs text-slate-500 mt-0.5">זמינה בכל עת בטאב המסמכים שלך</p>
          </div>
        </div>
        <Link href={`/client/documents?appointment=${appointmentId}`}>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            צפייה בקבלה
          </Button>
        </Link>
      </div>

      {pendingDocs.length > 0 && (
        <div className="mt-5 rounded-lg border border-warning-border bg-warning-bg p-4 text-right">
          <p className="flex items-center gap-2 text-sm font-bold text-warning-text mb-2">
            <AlertCircle className="h-5 w-5 shrink-0" /> מסמכים נדרשים לפני התור ({pendingDocs.length})
          </p>
          <ul className="flex flex-col gap-1 mb-3">
            {pendingDocs.map((d) => (
              <li key={d.id} className="text-xs text-warning-text/80">
                {d.title}
              </li>
            ))}
          </ul>
          <Link href={appointmentHref}>
            <Button size="sm" className="w-full">
              השלימו עכשיו
            </Button>
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
        <a href={confirmation.icsUrl} download="appointment.ics">
          <Button variant="outline">
            <Calendar className="h-4 w-4" /> הוסף ליומן
          </Button>
        </a>
        <Link href={appointmentHref}>
          <Button variant="outline">לצפייה בתור</Button>
        </Link>
        <Link href={homeHref}>
          <Button>
            {homeLabel} <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {otherServices.length > 0 && (
        <div className="mt-8 text-right">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-700 mb-1">
            <Sparkles className="h-4 w-4 text-primary" /> שירותים רלוונטיים נוספים
          </p>
          <p className="text-xs text-slate-400 text-center mb-3">
            בהתאם לשירות שהזמנת, אולי יעניין אתכם גם:
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {otherServices.map((ct) => (
              <ServiceItemCard
                key={ct.id}
                name={ct.name}
                durationMinutes={ct.duration_minutes}
                tag={ct.service_type ? PROVIDER_SERVICE_TYPE_LABELS[ct.service_type] : undefined}
                onSelect={() =>
                  showToast("בקרוב", { description: "הזמנה ישירה של שירות מוצע תתאפשר כאן בהמשך" })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
