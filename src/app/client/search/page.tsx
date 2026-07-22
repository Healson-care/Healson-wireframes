"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { resolveProviderPrice } from "@/lib/pricing";
import { BookingStepper, BookingStepperMode } from "@/components/book/BookingStepper";
import { ServiceDiscovery, SelectedServiceItem } from "@/components/book/ServiceDiscovery";
import { DoctorPicker } from "@/components/book/DoctorPicker";
import { SlotPicker } from "@/components/book/SlotPicker";
import { PaymentPanel } from "@/components/book/PaymentPanel";
import { BookingConfirmation } from "@/components/book/BookingConfirmation";
import { WaitlistJoinDialog } from "@/components/book/WaitlistJoinDialog";
import { buildIcsDataUrl } from "@/lib/utils";
import { POST_REGISTER_REDIRECT_KEY } from "@/lib/constants";
import { ProviderProfile } from "@/types";

const HOLD_SECONDS = 600;

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
  const [discoveryMode, setDiscoveryMode] = useState<BookingStepperMode>("service");
  // Purely for the progress meter — ServiceDiscovery/SlotPicker each cover
  // two conceptual steps on one screen, so these track which sub-choice is
  // still in progress within the current `step` without adding new screens.
  const [discoveryDoctorForItems, setDiscoveryDoctorForItems] = useState<ProviderProfile | null>(null);
  const [discoveryClinicId, setDiscoveryClinicId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedServiceItem | null>(null);
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

  // Re-matched against the chosen doctor's own consultation_types (no shared
  // catalog id) — falls back to their first service only if the match
  // somehow fails, which DoctorPicker's own filtering should already prevent.
  const consultation = selectedProvider
    ? selectedProvider.consultation_types.find(
        (ct) => selectedItem && ct.name === selectedItem.name && ct.service_type === selectedItem.service_type
      ) ?? selectedProvider.consultation_types[0]
    : undefined;
  const resolvedPrice =
    consultation && selectedProvider ? resolveProviderPrice(consultation.prices, selectedProvider.agreements, patient) : null;
  const price = resolvedPrice?.price ?? consultation?.prices.find((p) => p.layer === "H")?.price ?? 0;
  // Always the private/out-of-pocket price, regardless of which layer this
  // patient actually qualifies for — shown alongside `price` so the payment
  // summary can show "full price" vs. "your price" as two distinct lines.
  const fullPrice = consultation?.prices.find((p) => p.layer === "H")?.price ?? price;

  // Maps the real `step` (which screen is showing) plus the two in-screen
  // sub-choices above onto the 6-item progress meter — see BookingStepper.
  const visualStep =
    step === 0
      ? discoveryMode === "doctor"
        ? discoveryDoctorForItems
          ? 1
          : 0
        : 0
      : step === 1
      ? 1
      : step === 2
      ? (discoveryClinicId ? 3 : 2)
      : step === 3
      ? 4
      : step === 4
      ? 5
      : step;

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
     
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setStep(3);
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
    setStep(2);
  }, [pendingAppointmentId, showToast, updateAppointment]);

  function handleReset() {
    setStep(0);
    setDiscoveryMode("service");
    setDiscoveryDoctorForItems(null);
    setDiscoveryClinicId(null);
    setSelectedItem(null);
    setSelectedProvider(null);
    setSelectedSlot(null);
    setHoldExpiresAt(null);
    setPendingAppointmentId(null);
    setConfirmation(null);
  }

  // Shared by both discovery paths: browsing services first (DoctorPicker
  // already knows selectedItem) and browsing by doctor first (ServiceDiscovery
  // hands the item back together with the provider, skipping DoctorPicker).
  function selectProviderForItem(item: SelectedServiceItem, p: ProviderProfile) {
    if (!patient) {
      showToast("השלימו הרשמה כדי לקבוע תור", {
        description: "כדי לראות מחירים ולקבוע תור נדרש פרופיל מטופל",
      });
      sessionStorage.setItem(POST_REGISTER_REDIRECT_KEY, "/client/search");
      router.push("/register");
      return;
    }
    setSelectedItem(item);
    setSelectedProvider(p);
    setStep(2);
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
      setStep(4);
    }, 1200);
  }

  return (
    <ClientLayout>
      <div className="max-w-2xl mx-auto">
        <BookingStepper step={visualStep} mode={discoveryMode} />

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
          {step === 0 && (
            <motion.div key="step0" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
              <ServiceDiscovery
                providers={providers}
                patient={patient}
                title="קבע תור חדש"
                description="חיפוש חופשי, או לפי סוג השירות — המחיר יוצג לפי הביטוח שלכם"
                onSelectItem={(item) => {
                  setSelectedItem(item);
                  setStep(1);
                }}
                onSelectItemWithProvider={selectProviderForItem}
                onDoctorForItemsChange={setDiscoveryDoctorForItems}
                onModeChange={setDiscoveryMode}
              />
            </motion.div>
          )}

          {step === 1 && selectedItem && (
            <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
              <DoctorPicker
                providers={providers}
                item={selectedItem}
                patient={patient}
                onBack={() => setStep(0)}
                onSelect={(p) => selectProviderForItem(selectedItem, p)}
              />
            </motion.div>
          )}

          {step === 2 && selectedProvider && (
            <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
              <button onClick={() => setStep(1)} className="text-sm text-primary mb-4 flex items-center gap-1">
                <ArrowRight className="h-3.5 w-3.5" /> בחירת רופא אחר
              </button>
              <SlotPicker
                provider={selectedProvider}
                appointments={appointments}
                onSelectSlot={selectSlot}
                onJoinWaitlist={(date, time, label) => setWaitlistSlot({ date, time, label })}
                onClinicChange={setDiscoveryClinicId}
                serviceId={consultation?.id}
              />
            </motion.div>
          )}

          {step === 3 && selectedProvider && selectedSlot && holdExpiresAt && (
            <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-md mx-auto">
              <button
                onClick={() => {
                  abandonHold();
                  setStep(2);
                }}
                className="text-sm text-primary mb-4 flex items-center gap-1"
              >
                <ArrowRight className="h-3.5 w-3.5" /> שינוי תור
              </button>
              <PaymentPanel
                provider={selectedProvider}
                itemName={consultation?.name}
                clinicId={discoveryClinicId ?? undefined}
                selectedSlot={selectedSlot}
                kupah={patient?.kupah}
                layer={resolvedPrice?.layer}
                price={price}
                fullPrice={fullPrice}
                holdExpiresAt={holdExpiresAt}
                onExpire={handleHoldExpire}
                payMethod={payMethod}
                onPayMethodChange={setPayMethod}
                paying={paying}
                onPay={handlePay}
              />
            </motion.div>
          )}

          {step === 4 && confirmation && selectedProvider && selectedSlot && pendingAppointmentId && (
            <motion.div key="step4" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
              <BookingConfirmation
                provider={selectedProvider}
                selectedSlot={selectedSlot}
                confirmation={confirmation}
                homeHref="/client/appointments"
                homeLabel="התורים שלי"
                appointmentId={pendingAppointmentId}
                bookedServiceName={consultation?.name}
              />
              <div className="flex justify-center mt-4">
                <Button variant="outline" onClick={handleReset}>
                  חיפוש שירות נוסף
                </Button>
              </div>
            </motion.div>
          )}
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
