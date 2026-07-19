"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, LogOut } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { resolveProviderPrice } from "@/lib/pricing";
import { BOOK_RESUME_PROVIDER_KEY, POST_REGISTER_REDIRECT_KEY } from "@/lib/constants";
import { Logo } from "@/components/shared/Logo";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { BookingStepper } from "@/components/book/BookingStepper";
import { ProviderDiscovery } from "@/components/book/ProviderDiscovery";
import { SlotPicker } from "@/components/book/SlotPicker";
import { PaymentPanel } from "@/components/book/PaymentPanel";
import { BookingConfirmation } from "@/components/book/BookingConfirmation";
import { WaitlistJoinDialog } from "@/components/book/WaitlistJoinDialog";
import { buildIcsDataUrl } from "@/lib/utils";
import { ProviderProfile } from "@/types";

const HOLD_SECONDS = 180;

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};
const stepTransition = { duration: 0.25, ease: "easeOut" as const };

export default function BookPage() {
  const router = useRouter();
  const providers = useStore((s) => s.providers);
  const appointments = useStore((s) => s.appointments);
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const addAppointment = useStore((s) => s.addAppointment);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const addOrder = useStore((s) => s.addOrder);
  const addDocument = useStore((s) => s.addDocument);
  const showToast = useStore((s) => s.showToast);
  const patient = useCurrentPatient();

  // Booking is strictly "pick a doctor, pick a time, pay" — registration and
  // login now live entirely in /client/login. Selecting a provider without
  // a registered patient record pops a dialog pointing there instead of
  // letting the flow continue.
  const [step, setStep] = useState(0);
  const [showAuthRequired, setShowAuthRequired] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string; label: string } | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const [waitlistSlot, setWaitlistSlot] = useState<{ date?: string; time?: string; label?: string } | null>(null);

  const [payMethod, setPayMethod] = useState<"card" | "apple" | "google">("card");
  const [paying, setPaying] = useState(false);

  const [confirmation, setConfirmation] = useState<{
    fileNumber: string;
    price: number;
    icsUrl: string;
  } | null>(null);
  const [pendingQuestionnaire, setPendingQuestionnaire] = useState<{ appointmentId: string; title: string } | null>(
    null
  );

  const consultation = selectedProvider?.consultation_types[0];
  const resolvedPrice =
    consultation && selectedProvider ? resolveProviderPrice(consultation.prices, selectedProvider.agreements, patient) : null;
  const price = resolvedPrice?.price ?? consultation?.prices.find((p) => p.layer === "H")?.price ?? 0;

  function handleSelectProvider(p: ProviderProfile) {
    if (!patient) {
      sessionStorage.setItem(BOOK_RESUME_PROVIDER_KEY, p.id);
      setShowAuthRequired(true);
      return;
    }
    setSelectedProvider(p);
    setStep(1);
  }

  // Resume straight at the slot picker for whichever provider the visitor
  // had clicked on right before getting blocked by the auth-required
  // popup, instead of dropping them back at the provider list once they
  // return here freshly logged in/registered.
  useEffect(() => {
    if (!patient) return;
    const resumeProviderId = sessionStorage.getItem(BOOK_RESUME_PROVIDER_KEY);
    if (!resumeProviderId) return;
    sessionStorage.removeItem(BOOK_RESUME_PROVIDER_KEY);
    const resumeProvider = providers.find((p) => p.id === resumeProviderId);
    // Syncing from sessionStorage (external, only known once patient/
    // hydration resolves) — not a derived-state anti-pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (resumeProvider) {
      setSelectedProvider(resumeProvider);
      setStep(1);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient]);

  // Only ever invoked from the slot button's onClick — safe to read the clock here.
  // Creating the appointment here (not at payment time) is deliberate: from the
  // moment a slot is picked it's "ממתין לתשלום מקדמה" in the patient's history,
  // even if they never complete payment.
  function selectSlot(date: string, time: string, label: string, clinicId: string) {
    if (!selectedProvider || !patient) return;
    if (patient.processing_restricted) {
      showToast("לא ניתן להמשיך", { description: "עיבוד הנתונים של מטופל זה חסום. פנה לתמיכה.", variant: "destructive" });
      return;
    }
    const appointment = addAppointment({
      client_name: patient.full_name,
      client_phone: patient.phone ?? "",
      provider_id: selectedProvider.id,
      provider_name: `${selectedProvider.title ?? ""} ${selectedProvider.display_name}`.trim(),
      service_name: consultation?.name ?? "ייעוץ",
      clinic_id: clinicId,
      date,
      time,
      duration_minutes: consultation?.duration_minutes ?? 30,
      status: "ממתין לתשלום מקדמה",
      price,
      deposit_amount: Math.round(price * 0.3),
      kupah: patient.kupah,
      notes: "",
      created_by_id: patient?.id ?? currentUser?.id,
    });
    setPendingAppointmentId(appointment.id);
    setSelectedSlot({ date, time, label });
    // eslint-disable-next-line react-hooks/purity -- event handler, not render logic
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setStep(2);
  }

  // Leaving the payment step without paying — whether the hold timer ran out
  // or the patient backed out manually — cancels that pending attempt instead
  // of leaving it stuck "ממתין לתשלום מקדמה" forever.
  function abandonHold() {
    if (pendingAppointmentId) updateAppointment(pendingAppointmentId, { status: "בוטל" });
    setPendingAppointmentId(null);
    setSelectedSlot(null);
    setHoldExpiresAt(null);
  }

  const handleHoldExpire = useCallback(() => {
    showToast("ה-Hold פג", { description: "התור שוחרר. רוצה לנסות שוב?", variant: "destructive" });
    if (pendingAppointmentId) updateAppointment(pendingAppointmentId, { status: "בוטל" });
    setPendingAppointmentId(null);
    setSelectedSlot(null);
    setHoldExpiresAt(null);
    setStep(1);
  }, [pendingAppointmentId, showToast, updateAppointment]);

  function handlePay() {
    if (!selectedProvider || !selectedSlot || !pendingAppointmentId || !patient) return;
    if (patient.processing_restricted) {
      showToast("לא ניתן להמשיך", { description: "עיבוד הנתונים של מטופל זה חסום. פנה לתמיכה.", variant: "destructive" });
      return;
    }
    setPaying(true);
    setTimeout(() => {
      const commissionRate = selectedProvider.commission_rate ?? 15;
      const commissionAmount = Math.round((price * commissionRate) / 100);
      // Payment success is the moment the pending hold becomes a confirmed
  // appointment.
      updateAppointment(pendingAppointmentId, { status: "מאושר", deposit_paid_at: new Date().toISOString() });
      addOrder({
        item_name: consultation?.name ?? "ייעוץ",
        provider_id: selectedProvider.id,
        provider_name: selectedProvider.display_name,
        created_by_id: patient?.id ?? currentUser?.id,
        patient_name: patient.full_name,
        final_price: price,
        status: "מאושר",
        payment_status: "מקדמה שולמה",
        deposit_amount: Math.round(price * 0.3),
        balance_amount: Math.round(price * 0.7),
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        provider_payout_amount: price - commissionAmount,
      });
      // The receipt and (if the service requires one) the pre-visit
      // questionnaire are created the moment the deposit clears, linked to
      // this appointment — same as the confirmation email/SMS a real clinic
      // would send at this point.
      const patientId = patient?.id ?? currentUser?.id;
      if (patientId) {
        addDocument({
          patient_id: patientId,
          category: "receipt",
          title: `קבלה על מקדמה - ${consultation?.name ?? "ייעוץ"}`,
          uploaded_by: "system",
          appointment_id: pendingAppointmentId,
          file: {
            file_name: "קבלה.pdf",
            uploaded_at: new Date().toISOString(),
            data_url: "data:application/pdf;base64,",
          },
        });
        if (consultation?.requires_questionnaire) {
          const questionnaireTitle = consultation.questionnaire_title ?? "שאלון לפני התור";
          addDocument({
            patient_id: patientId,
            category: "questionnaire",
            title: questionnaireTitle,
            uploaded_by: "system",
            appointment_id: pendingAppointmentId,
            status: "ממתין למילוי",
          });
          setPendingQuestionnaire({ appointmentId: pendingAppointmentId, title: questionnaireTitle });
        }
      }
      const icsUrl = buildIcsDataUrl({
        title: `תור ל-${selectedProvider.display_name}`,
        description: consultation?.name,
        location: selectedProvider.clinic_locations[0]?.address,
        date: selectedSlot.date,
        time: selectedSlot.time,
        durationMinutes: consultation?.duration_minutes ?? 30,
      });
      const fileNumber = Math.random().toString(36).slice(2, 8).toUpperCase();
      setConfirmation({ fileNumber, price, icsUrl });
      setPaying(false);
      setStep(3);
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5">
          <Link href="/">
            <Logo size={30} className="text-lg" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-500 hover:text-primary">
              חזרה לדף הבית
            </Link>
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push("/client/login");
                }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary"
              >
                <LogOut className="h-3.5 w-3.5" /> התנתק
              </button>
            ) : (
              <Link
                href="/client/login"
                onClick={() => sessionStorage.setItem(POST_REGISTER_REDIRECT_KEY, "/book")}
                className="text-sm font-medium text-primary hover:underline"
              >
                התחברות או הרשמה
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <BookingStepper step={step} />

        <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
            <ProviderDiscovery providers={providers} patient={patient} onSelect={handleSelectProvider} />
          </motion.div>
        )}

        {step === 1 && selectedProvider && (
          <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-2xl mx-auto">
            <button onClick={() => setStep(0)} className="text-sm text-primary mb-4 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> בחירת רופא אחר
            </button>
            <SlotPicker
              provider={selectedProvider}
              appointments={appointments}
              onSelectSlot={selectSlot}
              onJoinWaitlist={(date, time, label) => setWaitlistSlot({ date, time, label })}
            />
          </motion.div>
        )}

        {step === 2 && selectedProvider && selectedSlot && holdExpiresAt && (
          <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto">
            <button
              onClick={() => {
                abandonHold();
                setStep(1);
              }}
              className="text-sm text-primary mb-4 flex items-center gap-1"
            >
              <ArrowRight className="h-3.5 w-3.5" /> שינוי תור
            </button>
            <PaymentPanel
              provider={selectedProvider}
              selectedSlot={selectedSlot}
              kupah={patient?.kupah ?? "כללית"}
              layer={resolvedPrice?.layer}
              price={price}
              holdExpiresAt={holdExpiresAt}
              onExpire={handleHoldExpire}
              payMethod={payMethod}
              onPayMethodChange={setPayMethod}
              paying={paying}
              onPay={handlePay}
            />
          </motion.div>
        )}
        {step === 3 && confirmation && selectedProvider && selectedSlot && pendingAppointmentId && (
          <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
            <BookingConfirmation
              provider={selectedProvider}
              selectedSlot={selectedSlot}
              confirmation={confirmation}
              homeHref="/client"
              homeLabel="לאזור האישי שלי"
              appointmentId={pendingAppointmentId}
              pendingQuestionnaire={pendingQuestionnaire}
            />
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      <WaitlistJoinDialog
        provider={selectedProvider}
        slot={waitlistSlot}
        onClose={() => setWaitlistSlot(null)}


        clientName={patient?.full_name || "מטופל"}
        clientPhone={patient?.phone}
        createdById={patient?.id ?? currentUser?.id}
      />

      <ConfirmDialog
        open={showAuthRequired}
        onClose={() => setShowAuthRequired(false)}
        onConfirm={() => {
          sessionStorage.setItem(POST_REGISTER_REDIRECT_KEY, "/book");
          router.push("/client/login");
        }}
        title="נדרשת הרשמה או התחברות"
        description="לא ניתן לראות זמינות ללא התחברות או הרשמה"
        confirmLabel="המשך להתחברות/הרשמה"
      />
    </div>
  );
}
