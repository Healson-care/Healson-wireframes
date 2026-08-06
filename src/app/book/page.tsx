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
import { Offer, SearchQuery, emptyQuery, providerLabel } from "@/lib/search";
import { SlotPicker } from "@/components/book/SlotPicker";
import { PaymentPanel } from "@/components/book/PaymentPanel";
import { BookingConfirmation } from "@/components/book/BookingConfirmation";
import { WaitlistJoinDialog } from "@/components/book/WaitlistJoinDialog";
import { buildIcsDataUrl, formatCurrency } from "@/lib/utils";
import { serviceOfferedAt } from "@/lib/scheduling";
import { fileToDataUrl } from "@/lib/file";
import { requiresReferral } from "@/lib/referral";
import { ConsultationType, ProviderProfile } from "@/types";

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
  const organizationBranches = useStore((s) => s.organizationBranches);
  const appointments = useStore((s) => s.appointments);
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const addAppointment = useStore((s) => s.addAppointment);
  const updateAppointment = useStore((s) => s.updateAppointment);
  // The demo's stand-in for the unit answering runs the same store action the
  // provider portal runs, so the two paths can't drift apart.
  const approveAppointmentReferral = useStore((s) => s.approveAppointmentReferral);
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
  // The performing doctor, when the service belongs to an organization —
  // "זמינות אצל" must name the person, not the institute that owns the item.
  const [selectedDoctor, setSelectedDoctor] = useState<ProviderProfile | null>(null);
  // Search state lives here so stepping forward and back doesn't reset it.
  const [searchQuery, setSearchQuery] = useState<SearchQuery>(emptyQuery);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string; label: string } | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const [waitlistSlot, setWaitlistSlot] = useState<{ date?: string; time?: string; label?: string } | null>(null);

  const [payMethod, setPayMethod] = useState<"card" | "apple" | "google">("card");
  const [paying, setPaying] = useState(false);
  // Reading the referral off disk takes a tick, and the click that starts it
  // creates the request — so the button has to stop accepting a second one.
  const [submittingReferral, setSubmittingReferral] = useState(false);
  // Held here rather than inside PaymentPanel: leaving the payment step and
  // coming back shouldn't silently drop a referral the patient already picked.
  const [referralFile, setReferralFile] = useState<File | null>(null);
  // Route S's counterpart to the referral: the kupah's commitment (טופס 17).
  const [commitmentFile, setCommitmentFile] = useState<File | null>(null);
  // Set when the patient takes the "no commitment yet" fallback and pays a
  // refundable deposit instead — an open product decision, sketched only.
  const [commitmentFallback, setCommitmentFallback] = useState(false);

  const [confirmation, setConfirmation] = useState<{
    fileNumber: string;
    price: number;
    icsUrl: string;
  } | null>(null);

  const consultation = selectedService ?? undefined;
  // A doctor is in-network as a person, so their own agreements govern at any
  // of their clinics. Only a site's agreements (imaging, lab — services with
  // no doctor) can differ per branch, so only then does the clinic matter.
  const doctorAgreements = selectedDoctor?.agreements?.length ? selectedDoctor.agreements : undefined;
  const priceBreakdown =
    consultation && selectedProvider
      ? resolvePriceBreakdown(
          consultation.prices,
          doctorAgreements ?? selectedProvider.agreements,
          patient,
          consultation.price_full,
          consultation,
          doctorAgreements ? undefined : discoveryClinicId ?? undefined
        )
      : null;
  const price = priceBreakdown?.price ?? 0;
  // The base price (P), regardless of which layer this patient actually
  // qualifies for — shown alongside `price` so the payment summary can show
  // "full price" vs. "your price" as two distinct lines.
  const fullPrice = priceBreakdown?.basePrice ?? price;

  // A referred item goes through two extra stages before a time is ever shown
  // — the referral upload and the unit's review — so the meter has to describe
  // a different journey for it.
  const referralFlow = requiresReferral(consultation);
  // Routes settled by an undertaking — the kupah's טופס 17 for a basket
  // service, the insurer's for surgery under a private policy — collect that
  // document in place of a payment, and take no deposit.
  const commitment = priceBreakdown?.commitment;
  const commitmentFlow = !!commitment;
  // A service given at one location only never asks the patient to choose one,
  // so "מיקום" would be a stage she can never stand on — drop it from the rail.
  const bookableClinicCount =
    selectedProvider && consultation
      ? selectedProvider.clinic_locations.filter((c) => serviceOfferedAt(selectedProvider, consultation.id, c.id)).length
      : 0;
  const singleLocation = bookableClinicCount === 1;

  // The location screen shows each branch's price. For a doctor that's the
  // same everywhere — which is worth showing rather than hiding, so nobody
  // travels further hoping for a better price. For a station-run service it
  // genuinely differs, because the site's agreement can.
  const clinicPricing: Record<string, { amount?: string; note?: string }> = {};
  if (selectedProvider && consultation) {
    for (const clinic of selectedProvider.clinic_locations) {
      const breakdown = resolvePriceBreakdown(
        consultation.prices,
        doctorAgreements ?? selectedProvider.agreements,
        patient,
        consultation.price_full,
        consultation,
        doctorAgreements ? undefined : clinic.id
      );
      if (!breakdown) continue;
      clinicPricing[clinic.id] =
        breakdown.kind === "basket"
          ? { note: breakdown.label }
          : { amount: formatCurrency(breakdown.price), note: breakdown.label };
    }
  }
  const flowSteps = flowStepsFor({ referral: referralFlow, commitment: commitmentFlow, singleLocation });

  // Built from the rail itself rather than hard-coded indices, so dropping
  // "מיקום" for a single-location service can't put the meter out of step.
  const stageIndex = (name: string) => Math.max(0, flowSteps.indexOf(name));
  const visualStep =
    step === 0
      ? 0
      : step === 1
      ? stageIndex("הפניה")
      : step === 2
      ? discoveryClinicId || singleLocation
        ? stageIndex("שעה")
        : stageIndex("מיקום")
      : step === 5
      ? stageIndex("אישור יחידה")
      : step === 3
      ? stageIndex(commitmentFlow ? "התחייבות" : "תשלום")
      : step === 4
      ? stageIndex("סיום")
      : step;

  /**
   * The meter shows visual indices; the flow runs on real step numbers. This
   * is the inverse of `visualStep` above, so tapping a completed stage lands
   * on the screen that produced it. Forward taps are ignored — a stage isn't
   * reachable until the one before it is done.
   */
  function goToVisualStep(index: number) {
    if (index >= visualStep) return;
    // Map back through the rail's own labels, for the same reason.
    const label = flowSteps[index];
    const target =
      label === "בחירה" ? 0 : label === "הפניה" ? 1 : label === "אישור יחידה" ? 5 : label === "מיקום" || label === "שעה" ? 2 : 3;
    // How far back she goes decides how much is given up. Back to the picker
    // releases the slot but keeps the request — on a referred item that means
    // keeping the unit's answer, which is the expensive part. Back past the
    // referral screen abandons the request itself.
    if (target <= 1) abandonRequest();
    else if (step === 3 && target === 2) abandonHold();
    setStep(target);
  }

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
    setSelectedDoctor(offer.doctor ?? null);
    // A result IS a branch, so the branch she tapped carries straight through
    // — the price on the card and the price at payment are then the same
    // number by construction. SlotPicker still lets her change it from here.
    setDiscoveryClinicId(offer.clinic.id);
    setReferralFile(null);
    setCommitmentFile(null);
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

  /**
   * On a referred item the referral — not a slot — is what creates the request.
   * It enters the patient's history right here, dateless, so an answer that
   * takes days still has a record to arrive at, and the document travels on the
   * booking itself so the unit has something to actually review.
   */
  function submitReferral() {
    if (!selectedProvider || !patient || !referralFile || submittingReferral) return;
    if (patient.processing_restricted) {
      showToast("לא ניתן להמשיך", { description: "עיבוד הנתונים של מטופל זה חסום. פנה לתמיכה.", variant: "destructive" });
      return;
    }
    setSubmittingReferral(true);
    void (async () => {
      const dataUrl = await fileToDataUrl(referralFile);
      const uploadedAt = new Date().toISOString();
      const appointment = addAppointment({
        client_name: patient.full_name,
        client_phone: patient.phone ?? "",
        provider_id: selectedProvider.id,
        provider_name: `${selectedProvider.title ?? ""} ${selectedProvider.display_name}`.trim(),
        service_name: consultation?.name ?? "ייעוץ",
        // Neither a place nor a time yet — both are chosen only once the unit
        // has answered, which is the whole point of this stage.
        date: "",
        time: "",
        duration_minutes: consultation?.duration_minutes ?? 30,
        status: "ממתין לאישור הפניה",
        price,
        deposit_amount: resolveDepositAmount(price, consultation),
        kupah: patient.kupah,
        notes: "",
        created_by_id: patient?.id ?? currentUser?.id,
        referral_document: { file_name: referralFile.name, uploaded_at: uploadedAt, data_url: dataUrl },
      });
      setPendingAppointmentId(appointment.id);
      // Filed now rather than at payment: the referral was sent, so it belongs
      // in her documents whether or not the booking is ever completed.
      const patientId = patient?.id ?? currentUser?.id;
      if (patientId) {
        addDocument({
          patient_id: patientId,
          category: "referral_personal",
          title: "הפניה תקפה מקופת החולים",
          uploaded_by: "patient",
          appointment_id: appointment.id,
          status: "זמין",
          file: { file_name: referralFile.name, uploaded_at: uploadedAt, data_url: dataUrl },
        });
      }
      setSubmittingReferral(false);
      setStep(5);
    })();
  }

  // Only ever invoked from the slot button's onClick — safe to read the clock here.
  // A referred booking already exists by now (the unit approved it before any
  // time was on the table), so picking a slot fills that record in rather than
  // opening a second one. A direct booking has nothing yet, and is created here
  // so it shows up in the patient's history even if payment never happens.
  function selectSlot(date: string, time: string, label: string, clinicId: string) {
    if (!selectedProvider || !patient) return;
    if (patient.processing_restricted) {
      showToast("לא ניתן להמשיך", { description: "עיבוד הנתונים של מטופל זה חסום. פנה לתמיכה.", variant: "destructive" });
      return;
    }
    if (referralFlow && pendingAppointmentId) {
      updateAppointment(pendingAppointmentId, {
        date,
        time,
        clinic_id: clinicId,
        status: "ממתין לתשלום מקדמה",
      });
    } else {
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
        deposit_amount: resolveDepositAmount(price, consultation),
        kupah: patient.kupah,
        notes: "",
        created_by_id: patient?.id ?? currentUser?.id,
      });
      setPendingAppointmentId(appointment.id);
    }
    setSelectedSlot({ date, time, label });
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setStep(3);
  }

  // Leaving the payment step without paying — the hold timer ran out, or she
  // backed out. On a referred booking only the slot is given up: the unit's
  // approval was the expensive part and it survives, so she lands back on the
  // picker with the request still standing. A direct booking has nothing worth
  // keeping without a slot, so it is cancelled outright.
  function abandonHold() {
    if (pendingAppointmentId) {
      if (referralFlow) {
        updateAppointment(pendingAppointmentId, { date: "", time: "", status: "ממתין לקביעת מועד" });
      } else {
        updateAppointment(pendingAppointmentId, { status: "בוטל" });
        setPendingAppointmentId(null);
      }
    }
    setSelectedSlot(null);
    setHoldExpiresAt(null);
  }

  /** Walking away from the request itself — back past the referral screen —
   * rather than just from the slot. */
  function abandonRequest() {
    if (pendingAppointmentId) updateAppointment(pendingAppointmentId, { status: "בוטל" });
    setPendingAppointmentId(null);
    setSelectedSlot(null);
    setHoldExpiresAt(null);
  }

  /** Stands in for the medical unit answering from its own portal. Runs the
   * same store action the provider portal runs, so the demo shortcut and the
   * real path can't produce different bookings. */
  function approveByUnit() {
    if (pendingAppointmentId) approveAppointmentReferral(pendingAppointmentId);
    setStep(2);
  }

  const handleHoldExpire = useCallback(() => {
    showToast("ה-Hold פג", { description: "התור שוחרר. רוצה לנסות שוב?", variant: "destructive" });
    if (pendingAppointmentId) {
      if (referralFlow) {
        updateAppointment(pendingAppointmentId, { date: "", time: "", status: "ממתין לקביעת מועד" });
      } else {
        updateAppointment(pendingAppointmentId, { status: "בוטל" });
        setPendingAppointmentId(null);
      }
    }
    setSelectedSlot(null);
    setHoldExpiresAt(null);
    setStep(2);
  }, [pendingAppointmentId, referralFlow, showToast, updateAppointment]);

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
        // The referral itself is NOT filed here — it was sent to the unit long
        // before this point, and submitReferral filed it then.
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
                branches={organizationBranches}
              patient={patient}
              query={searchQuery}
              onQueryChange={setSearchQuery}
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
              submitting={submittingReferral}
              onContinue={submitReferral}
            />
          </motion.div>
        )}

        {step === 5 && selectedProvider && (
          <motion.div key="step5" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-2xl mx-auto">
            <UnitApprovalPending
              provider={selectedProvider}
              consultation={consultation}
              onSimulateApproval={approveByUnit}
            />
          </motion.div>
        )}

        {step === 2 && selectedProvider && (
          <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition} className="max-w-2xl mx-auto">
            {/* On a direct booking, back to the search exactly as she left it —
                same query, same filters, same card still open — instead of a
                separate "pick another service" screen that duplicates it.
                A referred booking has no such "back": the request is approved
                and saved, so the honest offer is to leave and finish later
                rather than a button that would throw the approval away. */}
            {referralFlow ? (
              <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
                ההפניה אושרה והבקשה נשמרה. אפשר לבחור מועד עכשיו, או לחזור לזה בכל שלב מ
                <Link href="/client/appointments" className="font-semibold underline">
                  התורים שלי
                </Link>
                .
              </p>
            ) : (
              <button onClick={() => setStep(0)} className="text-sm text-primary mb-4 flex items-center gap-1">
                <ArrowRight className="h-3.5 w-3.5" /> חזרה לבחירה
              </button>
            )}
            <SlotPicker
              provider={selectedProvider}
              appointments={appointments}
              onSelectSlot={selectSlot}
              onJoinWaitlist={(date, time, label) => setWaitlistSlot({ date, time, label })}
              onClinicChange={setDiscoveryClinicId}
              serviceId={consultation?.id}
              performerName={selectedDoctor ? providerLabel(selectedDoctor) : undefined}
              clinicPricing={clinicPricing}
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
              // No referral upload here any more: by the time payment is on the
              // screen the referral has been sent AND approved. Passing the
              // file without a change handler keeps the summary honest without
              // re-asking for a document that is already settled.
              referralFile={referralFile}
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
