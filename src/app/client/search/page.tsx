"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { resolveProviderPrice } from "@/lib/pricing";
import { ProviderDiscovery } from "@/components/book/ProviderDiscovery";
import { SlotPicker } from "@/components/book/SlotPicker";
import { PaymentPanel } from "@/components/book/PaymentPanel";
import { BookingConfirmation } from "@/components/book/BookingConfirmation";
import { WaitlistJoinDialog } from "@/components/book/WaitlistJoinDialog";
import { buildIcsDataUrl } from "@/lib/utils";
import { POST_REGISTER_REDIRECT_KEY } from "@/lib/constants";
import { ProviderProfile } from "@/types";

const HOLD_SECONDS = 180;

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};
const stepTransition = { duration: 0.25, ease: "easeOut" as const };

export default function ClientSearchPage() {
  const router = useRouter();
  const providers = useStore((s) => s.providers);
  const appointments = useStore((s) => s.appointments);
  const addAppointment = useStore((s) => s.addAppointment);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const addOrder = useStore((s) => s.addOrder);
  const addDocument = useStore((s) => s.addDocument);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  const patient = useCurrentPatient();

  const [step, setStep] = useState(0);
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

  const consultation = selectedProvider?.consultation_types[0];
  const resolvedPrice =
    consultation && selectedProvider ? resolveProviderPrice(consultation.prices, selectedProvider.agreements, patient) : null;
  const price = resolvedPrice?.price ?? consultation?.prices.find((p) => p.layer === "H")?.price ?? 0;

  // Creating the appointment here (not at payment time) is deliberate: from
  // the moment a slot is picked it's "ממתין לתשלום מקדמה" in the patient's
  // history, even if they never complete payment.
  function selectSlot(date: string, time: string, label: string, clinicId: string) {
    if (!selectedProvider) return;
    if (patient?.processing_restricted) {
      showToast("לא ניתן להמשיך", { description: "עיבוד הנתונים של מטופל זה חסום. פנה לתמיכה.", variant: "destructive" });
      return;
    }
    const appointment = addAppointment({
      client_name: currentUser?.full_name ?? "מטופל",
      client_phone: currentUser?.phone,
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
      kupah: patient?.kupah,
      notes: "",
      created_by_id: patient?.id ?? currentUser?.id,
    });
    setPendingAppointmentId(appointment.id);
    setSelectedSlot({ date, time, label });
    // eslint-disable-next-line react-hooks/purity -- event handler, not render logic
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setStep(2);
  }

  // Leaving the payment step without paying — hold timeout or manual back —
  // cancels that pending attempt instead of leaving it stuck forever.
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

  function handleReset() {
    setStep(0);
    setSelectedProvider(null);
    setSelectedSlot(null);
    setHoldExpiresAt(null);
    setPendingAppointmentId(null);
    setConfirmation(null);
  }

  function handlePay() {
    if (!selectedProvider || !selectedSlot || !pendingAppointmentId) return;
    if (patient?.processing_restricted) {
      showToast("לא ניתן להמשיך", { description: "עיבוד הנתונים של מטופל זה חסום. פנה לתמיכה.", variant: "destructive" });
      return;
    }
    setPaying(true);
    setTimeout(() => {
      const commissionRate = selectedProvider.commission_rate ?? 15;
      const commissionAmount = Math.round((price * commissionRate) / 100);
      // Payment success is the moment the pending hold becomes a confirmed
      // appointment — and the moment this lead becomes a client in practice.
      updateAppointment(pendingAppointmentId, { status: "מאושר", deposit_paid_at: new Date().toISOString() });
      addOrder({
        item_name: consultation?.name ?? "ייעוץ",
        provider_id: selectedProvider.id,
        provider_name: selectedProvider.display_name,
        created_by_id: patient?.id ?? currentUser?.id,
        patient_name: currentUser?.full_name ?? "מטופל",
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
      // this appointment.
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
        }
        for (const doc of consultation?.required_documents ?? []) {
          addDocument({
            patient_id: patientId,
            category: "referral_personal",
            title: doc.label,
            uploaded_by: "system",
            appointment_id: pendingAppointmentId,
            status: "ממתין למילוי",
          });
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
    <ClientLayout>
      <div className="max-w-2xl mx-auto">
        {step === 0 && (
          <p
            className={`text-xs rounded-lg px-3 py-2 mb-4 border ${
              patient ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200"
            }`}
          >
            {patient
              ? "המחיר לכל רופא מוצג בהתאם לפרופיל הביטוחי שלך."
              : "השלימו את הפרופיל הביטוחי שלכם בעמוד הפרופיל כדי לראות מחיר מותאם אישית."}
          </p>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {step === 0 && (
              <ProviderDiscovery
                providers={providers}
                patient={patient}
                title="קבע תור חדש"
                description="חיפוש חופשי, או לפי סוג השירות — המחיר יוצג לפי הביטוח שלכם"
                onSelect={(p) => {
                  if (!patient) {
                    showToast("השלימו הרשמה כדי לקבוע תור", {
                      description: "כדי לראות מחירים ולקבוע תור נדרש פרופיל מטופל",
                    });
                    sessionStorage.setItem(POST_REGISTER_REDIRECT_KEY, "/client/search");
                    router.push("/register");
                    return;
                  }
                  setSelectedProvider(p);
                  setStep(1);
                }}
              />
            )}

            {step === 1 && selectedProvider && (
              <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
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
                  kupah={patient?.kupah}
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
                  homeHref="/client/appointments"
                  homeLabel="התורים שלי"
                  appointmentId={pendingAppointmentId}
                />
                <div className="text-center mt-4">
                  <button onClick={handleReset} className="text-sm text-slate-400 hover:text-primary">
                    חיפוש שירות נוסף
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <WaitlistJoinDialog
        provider={selectedProvider}
        slot={waitlistSlot}
        onClose={() => setWaitlistSlot(null)}
        clientName={currentUser?.full_name ?? "מטופל"}
        clientPhone={currentUser?.phone}
        createdById={patient?.id ?? currentUser?.id}
      />
    </ClientLayout>
  );
}
