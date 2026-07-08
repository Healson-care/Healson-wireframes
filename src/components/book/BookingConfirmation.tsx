"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, CheckCircle2, FileText, PartyPopper, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { ProviderProfile } from "@/types";

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
}: {
  provider: ProviderProfile;
  selectedSlot: { date: string; time: string; label: string };
  confirmation: { fileNumber: string; price: number; icsUrl: string };
  homeHref: string;
  homeLabel: string;
}) {
  const showToast = useStore((s) => s.showToast);

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
        {provider.title} {provider.display_name} · {selectedSlot.label} בשעה {selectedSlot.time}
      </p>
      <p className="text-xs text-slate-400 mt-1">מספר תיק לקוח #{confirmation.fileNumber}</p>

      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
        <a href={confirmation.icsUrl} download="appointment.ics">
          <Button variant="outline">
            <Calendar className="h-4 w-4" /> הוסף ליומן
          </Button>
        </a>
        <Button variant="outline" onClick={() => showToast("תזכורת נשלחה בוואטסאפ ובמייל", { variant: "success" })}>
          <Sparkles className="h-4 w-4" /> שלחו לי תזכורת
        </Button>
        <Link href={homeHref}>
          <Button>
            {homeLabel} <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
          <FileText className="h-4 w-4 text-primary" /> מה קורה עכשיו
        </p>
        <ul className="flex flex-col gap-2.5 text-sm text-slate-500">
          <li className="flex items-center justify-between">
            <span>תזכורת + צ׳קליסט להגעה</span>
            <span className="text-xs text-slate-400">24 שעות לפני</span>
          </li>
          <li className="flex items-center justify-between">
            <span>תזכורת אחרונה + קישור להעלאת מסמכים</span>
            <span className="text-xs text-slate-400">שעתיים לפני</span>
          </li>
          <li className="flex items-center justify-between">
            <span>ביקור, תשלום וקבלה דיגיטלית</span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <PartyPopper className="h-3 w-3" /> ביום התור
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span>סיכום ביקור + דירוג חוויה</span>
            <span className="text-xs text-slate-400">יומיים אחרי</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
