"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, LogOut } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { resolvePriceBreakdown } from "@/lib/pricing";
import { resolveDepositAmount, resolveBalanceAmount } from "@/lib/deposit";
import { BOOK_RESUME_ITEM_KEY, BOOK_RESUME_PROVIDER_KEY, POST_REGISTER_REDIRECT_KEY } from "@/lib/constants";
import { Logo } from "@/components/shared/Logo";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { BookingStepper, flowStepsFor } from "@/components/book/BookingStepper";
import { CommitmentStep } from "@/components/book/CommitmentStep";
import { ReferralStep } from "@/components/book/ReferralStep";
import { UnitApprovalPending } from "@/components/book/UnitApprovalPending";
import { ServiceSearch } from "@/components/search/ServiceSearch";
import { Offer, SearchQuery, emptyQuery } from "@/lib/search";
import { SlotPicker } from "@/components/book/SlotPicker";
import { PaymentPanel } from "@/components/book/PaymentPanel";
import { BookingConfirmation } from "@/components/book/BookingConfirmation";
import { WaitlistJoinDialog } from "@/components/book/WaitlistJoinDialog";
import { buildIcsDataUrl } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/file";
import { requiresReferral } from "@/lib/referral";
import { ConsultationType, ProviderProfile, UNIT_APPROVAL_HOLD_HOURS } from "@/types";

const HOLD_SECONDS = 600;

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

  // Booking is strictly "pick a service, pick a doctor, pick a time, pay" —
  // registration and login now live entirely in /client/login. Selecting a
  // doctor without a registered patient record pops a dialog pointing there
  // instead of letting the flow continue.
  const [step, setStep] = useState(0);
  const [showAuthRequired, setShowAuthRequired] = useState(false);
  // Purely for the progress meter — SlotPicker covers two conceptual steps on
  // one screen (location, then time), so this tracks which of the two is
  // still in progress within the current `step` without adding a new screen.
  const [discoveryClinicId, setDiscoveryClinicId] = useState<string | null>(null);

  // The exact service being booked, straight off the chosen Offer — no need to
  // re-match it by name against the provider's catalogue.
  const [selectedService, setSelectedService] = useState<ConsultationType | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null);
  // Search state lives here so stepping forward and back doesn't reset it.
  const [searchQuery, setSearchQuery] = useState<SearchQuery>(emptyQuery);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string; label: string } | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const [waitlistSlot, setWaitlistSlot] = useState<{ date?: string; time?: string; label?: string } | null>(null);

  const [payMethod, setPayMethod] = useState<"card" | "apple" | "google">("card");
  const [paying, setPaying] = useState(false);
  // Held here rather than inside PaymentPanel: leaving the payment step and
  // coming back shouldn't silently drop a referral the patient already picked.
  const [referralFile, setReferralFile] = useState<File | null>(null);
  // Route S's counterpart to the referral: the kupah's commitment (טופס 17).
  const [commitmentFile, setCommitmentFile] = useState<File | null>(null);
  // Set when the patient takes the "no commitment yet" fallback and pays a
  // refundable deposit instead — an open product decision, sketched only.
  const [commitmentFallback, setCommitmentFallback] = useState(false);
  // Sticky once the patient has moved past the search even one time — used to
  // drop first-visit copy when she comes back to change something. Reset only
  // by a full flow restart.
  const [hasAdvanced, setHasAdvanced] = useState(false);

  const [confirmation, setConfirmation] = useState<{
    fileNumber: string;
    price: number;
    icsUrl: string;
  } | null>(null);

  const consultation = selectedService ?? undefined;
  const priceBreakdown =
    consultation && selectedProvider
      ? resolvePriceBreakdown(
          consultation.prices,
          selectedProvider.agreements,
          patient,
          consultation.price_full,
          consultation
        )
      : null;
  const price = priceBreakdown?.price ?? 0;
  // The base price (P), regardless of which layer this patient actually
  // qualifies for — shown alongside `price` so the payment summary can show
  // "full price" vs. "your price" as two distinct lines.
  const fullPrice = priceBreakdown?.basePrice ?? price;

  // Everything that isn't a consultation goes through two extra stages — the
  // referral upload and the unit's review — so the meter has to describe a
  // different journey for it.
  const referralFlow = requiresReferral(consultation);
  // Routes settled by an undertaking — the kupah's טופס 17 for a basket
  // service, the insurer's for surgery under a private policy — collect that
  // document in place of a payment, and take no deposit.
  const commitment = priceBreakdown?.commitment;
  const commitmentFlow = !!commitment;
  const flowSteps = flowStepsFor({ referral: referralFlow, commitment: commitmentFlow });

  // step: 0 search · 1 referral · 2 slot · 5 unit approval · 3 payment · 4 done
  const visualStep = referralFlow
    ? step === 0
      ? 0
      : step === 1
      ? 1
      : step === 2
      ? discoveryClinicId
        ? 3
        : 2
      : step === 5
      ? 4
      : step === 3
      ? 5
      : step === 4
      ? 6
      : step
    : step === 0
    ? 0
    : step === 2
    ? discoveryClinicId
      ? 2
      : 1
    : step === 3
    ? 3
    : step === 4
    ? 4
    : step;

  /**
   * The meter shows visual indices; the flow runs on real step numbers. This
   * is the inverse of `visualStep` above, so tapping a completed stage lands
   * on the screen that produced it. Forward taps are ignored — a stage isn't
   * reachable until the one before it is done.
   */
  function goToVisualStep(index: number) {
    if (index >= visualStep) return;
    const target = referralFlow
      ? [0, 1, 2, 2, 5, 3, 4][index] ?? 0
      : [0, 2, 2, 3, 4][index] ?? 0;
    // Stepping back out of payment or the unit's queue releases the slot that
    // was being held for them, rather than leaving a stuck pending record.
    if ((step === 3 || step === 5) && target < 3) abandonHold();
    setStep(target);
  }

  const unitHoldUntilLabel = holdExpiresAt
    ? new Date(holdExpiresAt).toLocaleString("he-IL", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  // The search returns a whole Offer — service and provider resolved together
  // — so booking goes straight from a result to picking a time.
  function selectOffer(offer: Offer) {
    if (!patient) {
      sessionStorage.setItem(BOOK_RESUME_PROVIDER_KEY, offer.provider.id);
      sessionStorage.setItem(BOOK_RESUME_ITEM_KEY, offer.service.id);
      setShowAuthRequired(true);
      return;
    }
    setSelectedService(offer.service);
    setSelectedProvider(offer.provider);
    // Clear the location and referral picked for a *previous* offer.
    setDiscoveryClinicId(null);
    setReferralFile(null);
    setCommitmentFile(null);
    setHasAdvanced(true);
    // Non-consultations must produce a referral before a slot is even shown.
    setStep(requiresReferral(offer.service) ? 1 : 2);
  }

  // Resume straight at the slot picker for whichever provider/service the
  // visitor had picked right before getting blocked by the auth-required
  // popup, instead of dropping them back at the service list once they
  // return here freshly logged in/registered.
  useEffect(() => {
    if (!patient) return;
    const resumeProviderId = sessionStorage.getItem(BOOK_RESUME_PROVIDER_KEY);
    const resumeServiceId = sessionStorage.getItem(BOOK_RESUME_ITEM_KEY);
    if (!resumeProviderId || !resumeServiceId) return;
    sessionStorage.removeItem(BOOK_RESUME_PROVIDER_KEY);
    sessionStorage.removeItem(BOOK_RESUME_ITEM_KEY);
    const resumeProvider = providers.find((p) => p.id === resumeProviderId);
    // Only the ids are stored, so a service that was edited or removed while
    // the visitor was registering simply drops them back at the search.
    const resumeService = resumeProvider?.consultation_types.find((ct) => ct.id === resumeServiceId);
    // Syncing from sessionStorage (external, only known once patient/
    // hydration resolves) — not a derived-state anti-pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (resumeProvider && resumeService) {
      setSelectedService(resumeService);
      setSelectedProvider(resumeProvider);
      setStep(2);
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
      // A referral item can't be paid for until the unit has reviewed it, so
      // it enters the patient's history in the waiting state instead.
      status: referralFlow ? "ממתין לאישור היחידה הרפואית" : "ממתין לתשלום מקדמה",
      price,
      deposit_amount: resolveDepositAmount(price, consultation),
      kupah: patient.kupah,
      notes: "",
      created_by_id: patient?.id ?? currentUser?.id,
    });
    setPendingAppointmentId(appointment.id);
    setSelectedSlot({ date, time, label });

    if (referralFlow) {
      // The slot is held for a day while the unit answers — not the 10-minute
      // payment hold, which would expire long before a human replies.
      setHoldExpiresAt(Date.now() + UNIT_APPROVAL_HOLD_HOURS * 60 * 60 * 1000);
      setStep(5);
      return;
    }
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setStep(3);
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

  /** Stands in for the medical unit answering from its own portal. */
  function approveByUnit() {
    if (pendingAppointmentId) updateAppointment(pendingAppointmentId, { status: "ממתין לתשלום מקדמה" });
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setStep(3);
  }

  const handleHoldExpire = useCallback(() => {
    showToast("ה-Hold פג", { description: "התור שוחרר. רוצה לנסות שוב?", variant: "destructive" });
    if (pendingAppointmentId) updateAppointment(pendingAppointmentId, { status: "בוטל" });
    setPendingAppointmentId(null);
    setSelectedSlot(null);
    setHoldExpiresAt(null);
    setStep(2);
  }, [pendingAppointmentId, showToast, updateAppointment]);

  /**
   * Route S has nothing to charge — the kupah funds it — so the appointment is
   * confirmed by the commitment form instead of by a deposit, and the form is
   * filed alongside it. No Order is created: nothing was sold here.
   */
  function confirmWithCommitment() {
    if (!selectedProvider || !selectedSlot || !pendingAppointmentId) return;
    if (!commitmentFile) return;
    setPaying(true);
    void (async () => {
      const dataUrl = await fileToDataUrl(commitmentFile);
      updateAppointment(pendingAppointmentId, { status: "מאושר" });
      const patientId = patient?.id ?? currentUser?.id;
      if (patientId) {
        addDocument({
          patient_id: patientId,
          category: "referral_personal",
          title: commitment?.formLabel ?? "התחייבות",
          uploaded_by: "patient",
          appointment_id: pendingAppointmentId,
          status: "זמין",
          file: { file_name: commitmentFile.name, uploaded_at: new Date().toISOString(), data_url: dataUrl },
        });
      }
      const icsUrl = buildIcsDataUrl({
        title: `תור ל-${selectedProvider.display_name}`,
        description: consultation?.name,
        location: selectedProvider.clinic_locations[0]?.address,
        date: selectedSlot.date,
        time: selectedSlot.time,
        durationMinutes: consultation?.duration_minutes ?? 30,
      });
      setConfirmation({ fileNumber: Math.random().toString(36).slice(2, 8).toUpperCase(), price: 0, icsUrl });
      setPaying(false);
      setStep(4);
    })();
  }

  async function handlePay() {
    if (!selectedProvider || !selectedSlot || !pendingAppointmentId || !patient) return;
    if (patient.processing_restricted) {
      showToast("לא ניתן להמשיך", { description: "עיבוד הנתונים של מטופל זה חסום. פנה לתמיכה.", variant: "destructive" });
      return;
    }
    // Guard the rule itself, not just the button: a service that demands a
    // referral can't be booked without one, however the call got here.
    if (requiresReferral(consultation) && !referralFile) {
      showToast("נדרשת הפניה", { description: "צרפו הפניה תקפה מקופת החולים כדי לשריין את התור.", variant: "destructive" });
      return;
    }
    setPaying(true);
    const referralDataUrl = referralFile ? await fileToDataUrl(referralFile) : "";
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
        deposit_amount: resolveDepositAmount(price, consultation),
        balance_amount: resolveBalanceAmount(price, consultation),
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
        // The referral was a condition of booking, not a follow-up task — it
        // was already attached at the payment step, so it lands as a filed
        // document rather than another thing waiting on the patient.
        if (requiresReferral(consultation) && referralFile) {
          addDocument({
            patient_id: patientId,
            category: "referral_personal",
            title: "הפניה תקפה מקופת החולים",
            uploaded_by: "patient",
            appointment_id: pendingAppointmentId,
            status: "זמין",
            file: {
              file_name: referralFile.name,
              uploaded_at: new Date().toISOString(),
              data_url: referralDataUrl,
            },
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
        {/* Hidden while searching: browsing isn't a stage of a booking, and a
            meter whose length changes the moment an item is picked (a referral
            item has two stages more than a consultation) reads as broken. It
            appears once an item is chosen — by then its journey is known and
            the meter never changes shape again. */}
        {step !== 0 && step !== 4 && (
          <BookingStepper step={visualStep} steps={flowSteps} onStepSelect={goToVisualStep} />
        )}
        {step === 4 && <BookingStepper step={visualStep} steps={flowSteps} />}

        <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-2xl mx-auto">
            <ServiceSearch
              providers={providers}
              patient={patient}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              openKey={openGroupKey}
              onOpenKeyChange={setOpenGroupKey}
              onSelectOffer={selectOffer}
            />
          </motion.div>
        )}

        {step === 1 && selectedProvider && (
          <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-2xl mx-auto">
            <ReferralStep
              provider={selectedProvider}
              consultation={consultation}
              file={referralFile}
              onFileChange={setReferralFile}
              onBack={() => setStep(0)}
              onContinue={() => setStep(2)}
            />
          </motion.div>
        )}

        {step === 5 && selectedProvider && selectedSlot && (
          <motion.div key="step5" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-2xl mx-auto">
            <UnitApprovalPending
              provider={selectedProvider}
              consultation={consultation}
              selectedSlot={selectedSlot}
              clinicName={
                selectedProvider.clinic_locations.find((c) => c.id === discoveryClinicId)?.name ??
                selectedProvider.clinic_locations[0]?.name
              }
              holdUntilLabel={unitHoldUntilLabel}
              onSimulateApproval={approveByUnit}
            />
          </motion.div>
        )}

        {step === 2 && selectedProvider && (
          <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-2xl mx-auto">
            {/* Back to the search exactly as she left it — same query, same
                filters, same card still open — instead of a separate
                "pick another service" screen that duplicates it. */}
            <button onClick={() => setStep(referralFlow ? 1 : 0)} className="text-sm text-primary mb-4 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5" /> {referralFlow ? "חזרה להפניה" : "חזרה לבחירה"}
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
            {commitment && !commitmentFallback ? (
              <CommitmentStep
                provider={selectedProvider}
                consultation={consultation}
                selectedSlot={selectedSlot}
                commitment={commitment}
                coverageLabel={priceBreakdown?.label ?? "מכוסה"}
                clinicName={
                  selectedProvider.clinic_locations.find((c) => c.id === discoveryClinicId)?.name ??
                  selectedProvider.clinic_locations[0]?.name
                }
                basePrice={fullPrice}
                holdExpiresAt={holdExpiresAt}
                onExpire={handleHoldExpire}
                file={commitmentFile}
                onFileChange={setCommitmentFile}
                submitting={paying}
                onConfirmWithCommitment={confirmWithCommitment}
                onPayDepositInstead={() => setCommitmentFallback(true)}
              />
            ) : (
            <PaymentPanel
              provider={selectedProvider}
              itemName={consultation?.name}
              consultation={consultation}
              clinicId={discoveryClinicId ?? undefined}
              selectedSlot={selectedSlot}
              kupah={patient?.kupah}
              layer={priceBreakdown?.layer}
              price={price}
              fullPrice={fullPrice}
              holdExpiresAt={holdExpiresAt}
              onExpire={handleHoldExpire}
              payMethod={payMethod}
              onPayMethodChange={setPayMethod}
              paying={paying}
              onPay={handlePay}
              referralFile={referralFile}
              onReferralFileChange={setReferralFile}
            />
            )}
          </motion.div>
        )}
        {step === 4 && confirmation && selectedProvider && selectedSlot && pendingAppointmentId && (
          <motion.div key="step4" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
            <BookingConfirmation
              provider={selectedProvider}
              selectedSlot={selectedSlot}
              confirmation={confirmation}
              homeHref="/client"
              homeLabel="לאזור האישי שלי"
              appointmentId={pendingAppointmentId}
              bookedServiceName={consultation?.name}
              consultation={consultation}
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
