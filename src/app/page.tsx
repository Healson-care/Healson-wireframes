"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  UserRound,
  Stethoscope,
  ShieldCheck,
  Sparkles,
  Phone,
  Building2,
  ArrowLeft,
  CalendarPlus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/shared/Logo";
import { KUPAH_LOGOS } from "@/lib/medical-tree";
import { homeForRole } from "@/lib/useRequireRole";
import { KUPOT, Role } from "@/types";

const HOSPITALS = ["הדסה", "שערי צדק", "אסותא", " איכילוב"];

const ROLE_CARDS: {
  role: Role;
  label: string;
  desc: string;
  icon: typeof UserRound;
  ring: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    role: "patient",
    label: "מטופל",
    desc: "חיפוש שירותים, קביעת תורים ומעקב תוצאות מעבדה",
    icon: UserRound,
    ring: "hover:ring-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    role: "provider",
    label: "ספק שירות",
    desc: "ניהול מרפאה, יומן תורים, הפניות ומטופלים",
    icon: Stethoscope,
    ring: "hover:ring-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    role: "admin",
    label: "מנהל מערכת",
    desc: "CRM, קטלוג שירותים, דוחות וניהול פלטפורמה",
    icon: ShieldCheck,
    ring: "hover:ring-indigo-200",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const hasHydrated = useStore((s) => s.hasHydrated);
  const loginAsDemo = useStore((s) => s.loginAsDemo);
  const showToast = useStore((s) => s.showToast);

  function enterAs(role: Role) {
    loginAsDemo(role);
    if (role === "patient" && useStore.getState().pendingLoginVerification) {
      // Existing patient: loginAsDemo queued the double SMS+email OTP
      // step-up instead of signing in directly. Send them to /login, which
      // picks up the pending verification and resumes the OTP screens —
      // otherwise they'd be bounced from /client back to a blank login form
      // with no explanation.
      router.push("/login");
      return;
    }
    setTimeout(() => router.push(homeForRole(role)), 50);
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Logo size={32} className="text-lg" />
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/book" className="hover:text-primary transition-colors">קביעת תור</Link>
            <a href="#entry" className="hover:text-primary transition-colors">כניסה למערכת</a>
            <a href="#insurers" className="hover:text-primary transition-colors">קופות וביטוחים</a>
            <a href="#hospitals" className="hover:text-primary transition-colors">בתי חולים</a>
          </nav>
          <div className="flex items-center gap-2">
            {hasHydrated && (
              <>
                <Link href={currentUser ? homeForRole(currentUser.role) : "/login"}>
                  <Button variant={currentUser ? "primary" : "ghost"} size="sm">
                    אזור אישי
                  </Button>
                </Link>
                {!currentUser && (
                  <Link href="/book">
                    <Button size="sm">קביעת תור</Button>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-40 -left-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:pt-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> פעיל 24/7 · בית החולים הווירטואלי של HEALSON
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-[1.15] tracking-tight">
                תיאום, זימון וניהול
                <br />
                שירותי בריאות <span className="text-accent">שלמה</span>
              </h1>
              <p className="mt-4 text-slate-500 leading-relaxed max-w-md text-lg">
                HEALSON מנגישה שירותי רפואה שלמה — תיאום וזימון שירותי בריאות ללקוחות כל קופות החולים וחברות הביטוח.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href="/book">
                  <Button size="lg" className="shadow-lg shadow-primary/25">
                    <CalendarPlus className="h-4 w-4" /> מצאו רופא וקבעו תור
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => showToast("הילי תהיה זמינה בקרוב", { description: "העוזרת הרפואית החכמה בדרך אליכם" })}
                >
                  <Sparkles className="h-4 w-4" /> הילי - העוזרת הרפואית שלך
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => showToast("נציג יחזור אליכם בהקדם", { variant: "success" })}
                >
                  <Phone className="h-4 w-4" /> דבר עם נציג
                </Button>
              </div>

              <div id="insurers" className="mt-9">
                <p className="text-xs text-slate-400 mb-2">מקבלים את כל קופות החולים</p>
                <div className="flex flex-wrap gap-2">
                  {KUPOT.map((k) => (
                    <span
                      key={k}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
                    >
                      <span>{KUPAH_LOGOS[k]}</span> {k}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5" /> + ביטוחים פרטיים
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
            >
              <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-2xl shadow-primary/10">
                <Image
                  src="/images/hero-consult.jpg"
                  alt="תיאום ייעוץ רפואי מרחוק עם HEALSON"
                  width={512}
                  height={512}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <motion.div
                className="absolute -top-4 -left-4 hidden sm:flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3.5 py-2 shadow-xl"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 18 }}
              >
                <span className="rounded-full bg-emerald-500/15 text-emerald-600 px-2 py-0.5 text-xs font-semibold">מאושר</span>
                <span className="text-xs text-slate-500">תור הבא: היום 14:00</span>
              </motion.div>
              <motion.div
                className="absolute -bottom-5 -right-5 hidden sm:flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-2.5 shadow-xl"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75, type: "spring", stiffness: 300, damping: 18 }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">+12,000 מטופלים</p>
                  <p className="text-[10px] text-slate-400">מנוהלים בפלטפורמה</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Only offered to anonymous visitors — once someone is already logged
          in (e.g. a lead mid-registration), this generic role-switch would
          silently swap them to a different demo account and let them skip
          straight into the personal area. The header's own "לאזור האישי"
          button already covers "already logged in" navigation correctly. */}
      {hasHydrated && !currentUser && (
        <section id="entry" className="mx-auto max-w-6xl px-4 py-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">כבר יש לכם תיק ב-HEALSON?</h2>
            <p className="text-slate-500 mt-2">בחרו את סוג החשבון שלכם לכניסה לאזור האישי — מצב הדגמה, כניסה מיידית</p>
          </div>
          <motion.div
            className="grid sm:grid-cols-3 gap-5"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1 } },
            }}
          >
            {ROLE_CARDS.map((card) => (
              <motion.button
                key={card.role}
                onClick={() => enterAs(card.role)}
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0 },
                }}
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.97 }}
                className={`group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-right shadow-sm ring-1 ring-transparent transition-shadow hover:shadow-lg ${card.ring}`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor}`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{card.label}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{card.desc}</p>
                </div>
                <span className="flex items-center gap-1 text-sm font-medium text-primary mt-1 group-hover:gap-2 transition-all">
                  כניסה כ{card.label} <ArrowLeft className="h-3.5 w-3.5" />
                </span>
              </motion.button>
            ))}
          </motion.div>
        </section>
      )}

      <section id="hospitals" className="mx-auto max-w-6xl px-4 pb-16">
        <div className="border-t border-slate-100 pt-10">
          <p className="text-center text-xs text-slate-400 mb-4">בשיתוף בתי חולים מובילים</p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {HOSPITALS.map((h) => (
              <span key={h} className="flex items-center gap-2 text-slate-400 font-medium">
                <Building2 className="h-4 w-4" /> {h}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        פלטפורמת ניהול שירותי בריאות בישראל © 2026 HEALSON
      </footer>
    </div>
  );
}
