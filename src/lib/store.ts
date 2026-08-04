import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  AffiliatedDoctor,
  Appointment,
  Branch,
  CatalogItem,
  CatalogRequest,
  ConsentRecord,
  ConsentType,
  CONSENT_DOCUMENT_VERSION,
  DsrRequest,
  DsrRequestStatus,
  Gender,
  Kupah,
  KLevel,
  Lead,
  LabReferral,
  Order,
  OtpIssueChannel,
  OtpIssueContext,
  OrganizationBranch,
  OtpIssueReport,
  Patient,
  PatientDocument,
  PatientInsurance,
  ProviderAffiliation,
  ProviderProfile,
  ProviderType,
  isPractitionerProviderType,
  ResourceSchedule,
  Role,
  ServiceArray,
  ServiceArrayType,
  SERVICE_ARRAY_TYPE_LABELS,
  ScheduleException,
  ServiceType,
  SkillDomain,
  SkillSubdomain,
  ToastItem,
  UploadedFile,
  User,
  VisitRecord,
  WaitlistEntry,
  WeeklySchedule,
} from "@/types";
import { DEFAULT_REMINDER_SETTINGS, ReminderSettings } from "@/lib/reminders";
import {
  DEMO_NEW_PATIENT_USER,
  SEED_AFFILIATIONS,
  SEED_APPOINTMENTS,
  SEED_BRANCHES,
  SEED_ORGANIZATION_BRANCHES,
  SEED_SERVICE_ARRAYS,
  SEED_CATALOG,
  SEED_CATALOG_REQUESTS,
  SEED_CONSENT_RECORDS,
  SEED_DOCUMENTS,
  SEED_DSR_REQUESTS,
  SEED_LAB_REFERRALS,
  SEED_LEADS,
  SEED_ORDERS,
  SEED_PATIENTS,
  SEED_PROVIDERS,
  SEED_USERS,
  SEED_VISIT_RECORDS,
} from "./mock-data";
import { SEED_SKILL_DOMAINS, SEED_SKILL_SUBDOMAINS } from "./medical-tree";
import { generateId, maskPhone } from "./utils";

// ---------------------------------------------------------------------------
// Auth slice
// ---------------------------------------------------------------------------
interface PendingRegistration {
  email: string;
  password: string;
  otp: string;
}

// Held between the account being created on /apply (registerProviderAccount,
// which also kicks off beginProviderVerification) and phone-OTP verification.
// This happens BEFORE the applicant fills out the rest of the application —
// see verifyProviderPhoneOtp / finalizeProviderApplication.
interface PendingProviderSubmission {
  providerId: string;
  otp: string;
}

// True 2FA — password (factor 1) + one OTP (factor 2), not three factors.
// The single code is sent to both SMS and email at once purely for delivery
// redundancy (if one channel fails, the other still has it) — it's still
// one factor to enter, not two sequential gates like registration's.
interface PendingLoginVerification {
  userId: string;
  otp: string;
}

// Email step is a link-click, not a code — matches how real signup email
// confirmation almost always works (click the link), unlike the SMS step
// (still a typed code, since there's no equivalent "link" concept for SMS).
// Generic step-up re-authentication — password + one OTP (sent to both SMS
// and email at once, same policy as login) — required before a sensitive
// *action* while already signed in (e.g. requesting a change to identifying
// details). Deliberately not tied to currentUser/login: this re-confirms
// "it's still really you" mid-session, it doesn't sign anyone in.
interface PendingReauth {
  otp: string;
}

// No emailOtp field: there's nothing to type, so nothing to check — the
// click itself is the proof, exactly like a real magic-link confirmation.
interface PendingRegistrationVerification {
  smsOtp: string;
  smsVerified: boolean;
}

// Same SMS-code-then-email-link double verification as registration (see
// PendingRegistrationVerification above) — password reset is an
// account-takeover vector, arguably the most sensitive of the three flows,
// so it shouldn't be weaker than registration's identity-proofing. No
// emailOtp field: like registration, the email step is a link to click, not
// a code to type — nothing to check but whether SMS was verified first.
// `verified` only flips to true once both steps pass; resetPassword()
// refuses to run otherwise, so /reset-password can't be reached by just
// navigating to the URL.
interface PendingPasswordReset {
  contact: string;
  // /forgot-password is shared by two different login screens (patient
  // /client/login vs staff/provider /login) — this is which one to send
  // the user back to, both for the "חזרה להתחברות" link and after a
  // successful reset, instead of hardcoding the wrong one for half the
  // users of this flow.
  loginPath: string;
  // Masked phone the SMS OTP is "sent to" — looked up from the matching
  // account so the SMS step doesn't just claim a code was texted out of
  // nowhere (the user only typed an email, never a phone, on this flow).
  // Undefined when `contact` doesn't match any account; the screen falls
  // back to generic wording in that case, same anti-enumeration reasoning
  // as forgotPassword() itself never confirming a match either way.
  maskedPhone?: string;
  smsOtp: string;
  smsVerified: boolean;
  verified: boolean;
}

export interface InsuranceProfileInput {
  kupah?: Kupah;
  k_level?: KLevel;
  b_insurances?: PatientInsurance[];
  address?: string;
}

export type RegistrationConsents = Partial<Record<ConsentType, boolean>>;

interface AuthState {
  currentUser: User | null;
  pendingRegistration: PendingRegistration | null;
  pendingProviderSubmission: PendingProviderSubmission | null;
  pendingLoginVerification: PendingLoginVerification | null;
  login: (
    email: string,
    password: string
  ) => {
    ok: boolean;
    error?: string;
    requiresOtp?: boolean;
    // Set when a provider is blocked from logging in by their lifecycle
    // status — lets the login page render a dedicated blocked-state panel
    // (reason, what to do next) instead of a generic one-line error.
    blockedStatus?: "rejected" | "suspended";
  };
  verifyLoginOtp: (code: string) => { ok: boolean; error?: string };
  resendLoginOtp: () => string | null;
  // Step-up re-auth (password already checked by the caller before calling
  // this — there's nothing real to verify it against, see login()) — this
  // just issues/checks the OTP half. Used before sensitive in-session
  // actions like requesting identifying-details changes.
  pendingReauth: PendingReauth | null;
  beginReauth: () => string;
  verifyReauthOtp: (code: string) => { ok: boolean; error?: string };
  resendReauthOtp: () => string | null;
  pendingRegistrationVerification: PendingRegistrationVerification | null;
  beginRegistrationVerification: () => void;
  // Clears a stale pending verification left over from a registration the
  // user abandoned mid-way in a previous session (this store persists to
  // localStorage) — called when a fresh registration reaches the SMS screen
  // without a phone number yet, so that screen reliably shows the phone
  // prompt instead of mistaking old state for "already sent".
  resetRegistrationVerification: () => void;
  verifyRegistrationSmsOtp: (code: string) => { ok: boolean; error?: string };
  // No code param — clicking the (simulated) email link is itself the proof.
  verifyRegistrationEmailLink: () => { ok: boolean; error?: string };
  // Returns a code for "sms" (still shown as a demo hint), but null-ish
  // signal for "email" doesn't apply — resending an email link has nothing
  // to display except a confirmation toast, so callers should treat the
  // email branch as fire-and-forget (see resendRegistrationOtp below).
  resendRegistrationOtp: (channel: "sms" | "email") => string | null;
  loginWithGoogle: () => void;
  register: (email: string, password: string) => { ok: boolean; otpHint: string };
  verifyOtp: (email: string, code: string) => { ok: boolean; error?: string };
  resendOtp: () => string | null;
  // Provider signup step 1 — creates the User + a ProviderProfile (already
  // carrying the provider type picked on /apply) and logs the applicant in
  // immediately (mirrors register/verifyOtp above), instead of waiting until
  // Ops verifies the license (see PROV-ONBOARDING).
  registerProviderAccount: (
    full_name: string,
    phone: string,
    email: string,
    password: string,
    providerType?: ProviderType
  ) => { ok: boolean; error?: string; providerId?: string };
  // Provider signup step 2 — fires right after the account is created, before
  // any application details are collected. Stages phone-OTP verification;
  // verifying it only sets phone_verified_at (application submission is a
  // separate, later step — see finalizeProviderApplication).
  beginProviderVerification: (providerId: string) => { ok: boolean; error?: string; otpHint?: string };
  verifyProviderPhoneOtp: (code: string) => { ok: boolean; error?: string; providerId?: string };
  resendProviderPhoneOtp: () => string | null;
  // NOTE: there is deliberately no provider email-verification action. The
  // mail sent when a provider account is created is a welcome notification,
  // not a gate — unlike the patient flow, nothing in the join journey waits
  // on it being opened.
  // Provider signup step 3 — called once the applicant has filled out the
  // rest of the application (license, catalog basics, etc. — already
  // persisted incrementally via upsertProviderProfile) and clicks "שליחת
  // בקשה". Phone + email are already verified by this point, so this just
  // re-checks license-number uniqueness and flips application_submitted_at.
  finalizeProviderApplication: (providerId: string) => { ok: boolean; error?: string };
  pendingPasswordReset: PendingPasswordReset | null;
  forgotPassword: (contact: string, loginPath?: string) => { ok: boolean; otpHint?: string; error?: string };
  verifyPasswordResetSmsOtp: (code: string) => { ok: boolean; error?: string };
  // No code param — clicking the (simulated) email link is itself the proof,
  // same as verifyRegistrationEmailLink above.
  verifyPasswordResetEmailLink: () => { ok: boolean; error?: string };
  resendPasswordResetOtp: (channel: "sms" | "email") => string | null;
  resetPassword: (newPassword: string) => { ok: boolean; error?: string };
  logout: () => void;
  loginAsDemo: (role: Role, patientVariant?: "new" | "existing") => void;
  // Signs in as one *specific* seeded demo account rather than "the first user
  // with this role" — used by the secure-provider-login demo, where the
  // visitor picks which kind of provider portal to see (single practitioner
  // vs. medical unit). Returns false when the id isn't a known user.
  loginAsDemoUser: (userId: string) => boolean;
  // Lets a signed-in user correct the identity details captured at signup
  // (name + phone) — the provider application form exposes both once a
  // provider type is picked, so the account isn't locked to a typo.
  updateCurrentUserDetails: (data: { full_name?: string; phone?: string }) => void;
  completePatientRegistration: (
    userId: string,
    data: {
      full_name: string;
      phone?: string;
      id_number: string;
      id_document_type?: "id" | "passport";
      id_document_photo?: UploadedFile;
      date_of_birth: string;
      gender?: Gender;
      parent_name?: string;
    } & InsuranceProfileInput,
    consents: RegistrationConsents
  ) => Patient;
}

// ---------------------------------------------------------------------------
// Toast slice
// ---------------------------------------------------------------------------
interface ToastState {
  toasts: ToastItem[];
  showToast: (title: string, opts?: { description?: string; variant?: ToastItem["variant"] }) => void;
  dismissToast: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Entities slice
// ---------------------------------------------------------------------------
interface EntitiesState {
  users: User[];
  patients: Patient[];
  leads: Lead[];
  providers: ProviderProfile[];
  organizationBranches: OrganizationBranch[];
  serviceArrays: ServiceArray[];
  // §PRV-10 — first-class provider⇄unit affiliations (see ProviderAffiliation).
  affiliations: ProviderAffiliation[];
  catalog: CatalogItem[];
  catalogRequests: CatalogRequest[];
  skillDomains: SkillDomain[];
  skillSubdomains: SkillSubdomain[];
  appointments: Appointment[];
  orders: Order[];
  labReferrals: LabReferral[];
  visitRecords: VisitRecord[];
  documents: PatientDocument[];
  waitlist: WaitlistEntry[];
  branches: typeof SEED_BRANCHES;
  consentRecords: ConsentRecord[];
  dsrRequests: DsrRequest[];
  otpIssueReports: OtpIssueReport[];
  defaultCommissionRate: number;
  commissionRateByServiceType: Partial<Record<ServiceType, number>>;
  reminderSettings: ReminderSettings;

  addPatient: (p: Omit<Patient, "id" | "created_date">) => Patient;
  updatePatient: (id: string, data: Partial<Patient>) => void;
  deletePatient: (id: string) => void;

  addLead: (l: Omit<Lead, "id" | "created_date">) => Lead;
  updateLead: (id: string, data: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  convertLead: (id: string) => Patient | undefined;

  addAdminUser: (data: { full_name: string; email: string; phone?: string }) => User;

  addBranch: (data: Omit<Branch, "id">) => Branch;
  deleteBranch: (id: string) => void;

  upsertProviderProfile: (
    userId: string | undefined,
    data: Partial<ProviderProfile>
  ) => ProviderProfile;
  updateProviderById: (id: string, data: Partial<ProviderProfile>) => void;
  verifyProviderLicense: (id: string) => void;
  demoApproveProvider: (id: string) => void;
  demoRejectProvider: (id: string, reason?: string) => void;
  rejectProvider: (id: string, reason: string) => void;
  requestProviderChanges: (id: string, reason: string) => void;
  requestProviderGoLive: (id: string) => void;
  approveProviderGoLive: (id: string) => void;
  suspendProvider: (id: string) => void;
  reinstateProvider: (id: string) => void;
  signProviderAgreement: (id: string) => void;

  // --- Admin-managed organizations (ניהול ספקים) ---------------------------
  // Healson ops creates every real organization by hand, then creates its
  // medical units under it (each unit is a full ProviderProfile pointing back
  // via parent_organization_id) and a login user per unit.
  createOrganization: (data: {
    display_name: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    member_provider_types?: ProviderType[];
  }) => ProviderProfile;
  // Branches (סניפים) — a physical site of a MEDICAL UNIT (ארגון → יחידה →
  // סניף). Each branch belongs to one unit (unit_id).
  addOrganizationBranch: (
    unitId: string,
    data: { name: string; city?: string; address?: string; contact_phone?: string; contact_email?: string }
  ) => { ok: boolean; error?: string; branch?: OrganizationBranch };
  updateOrganizationBranch: (id: string, data: Partial<Omit<OrganizationBranch, "id" | "unit_id">>) => void;
  deleteOrganizationBranch: (id: string) => { ok: boolean; error?: string };
  // מערכים (service lines) inside a branch (§PRV-08) — a first-class entity
  // typed from the predefined SERVICE_ARRAY_TYPES catalog. Deleting one detaches
  // every resource whose service_array_id pointed at it.
  addServiceArray: (
    branchId: string,
    data: { type: ServiceArrayType; name?: string }
  ) => { ok: boolean; error?: string; serviceArray?: ServiceArray };
  // `branch_id` is editable so a מערך can be MOVED between סניפים from the
  // מערכים screen. Its עמדות resolve their branch through the מערך, so they
  // follow automatically — nothing else needs rewriting.
  updateServiceArray: (
    id: string,
    data: Partial<Pick<ServiceArray, "type" | "name" | "branch_id" | "schedule" | "schedule_exceptions">>
  ) => void;
  deleteServiceArray: (id: string) => { ok: boolean; error?: string };
  // Internal: clears service_array_id off a unit's resources referencing gone מערכים.
  detachServiceArrays: (unitId: string, arrayIds: Set<string>) => void;
  addOrganizationUnit: (
    organizationId: string,
    data: {
      display_name: string;
      provider_type: ProviderType;
      specialty?: string;
      license_number?: string;
      contact_phone?: string;
      contact_email?: string;
    }
  ) => { ok: boolean; error?: string; unitId?: string };
  // Creates the unit's login user (role "provider"). Mock auth — returns a
  // one-time temp password shown to the admin, like verifyProviderLicense.
  createProviderUnitUser: (
    providerId: string,
    data: { full_name: string; email: string; phone?: string }
  ) => { ok: boolean; error?: string; user?: User; tempPassword?: string };

  // --- Affiliated doctors (§PRV-07, organizations only) -------------------
  // A doctor exists once in the platform. Before creating a new record the UI
  // calls findMatchingDoctors() with whatever identifying details have been
  // typed so far; if it returns anything, the user is offered the existing
  // record instead of creating a duplicate.
  findMatchingDoctors: (query: {
    license_number?: string;
    phone?: string;
    email?: string;
    full_name?: string;
  }) => ProviderProfile[];
  // Free-text roster search, for the "חיפוש רופא/ה קיים/ת במערכת" path where
  // the user is deliberately looking for someone rather than being warned about
  // a duplicate: substring match on name / license / specialty / phone / email.
  searchDoctors: (query: string) => ProviderProfile[];
  addAffiliatedDoctor: (
    organizationId: string,
    data: {
      display_name: string;
      title?: string;
      specialty: string;
      sub_specialties?: string[];
      license_number?: string;
      contact_phone?: string;
      contact_email?: string;
      license_file?: UploadedFile;
      role?: string;
      service_ids?: string[];
      clinic_ids?: string[];
    }
  ) => { ok: boolean; error?: string; doctorId?: string };
  linkExistingDoctorToOrganization: (
    organizationId: string,
    doctorProviderId: string,
    data?: { role?: string; service_ids?: string[]; clinic_ids?: string[] }
  ) => { ok: boolean; error?: string };
  updateAffiliatedDoctor: (
    organizationId: string,
    affiliationId: string,
    data: Partial<Pick<AffiliatedDoctor, "role" | "service_ids" | "clinic_ids" | "service_array_id" | "branch_id">>
  ) => void;
  removeAffiliatedDoctor: (organizationId: string, affiliationId: string) => void;

  // --- Provider ⇄ unit affiliations (§PRV-10) ------------------------------
  // First-class, bidirectionally-consented links between an individual service
  // provider (any human provider type) and a medical unit. Replaces the
  // embedded AffiliatedDoctor path above. Consent direction is derived from
  // `initiated_by`: the OTHER side accepts. Every mutation stamps updated_at.
  //
  // Unit invites a provider already on the platform → status invited_by_unit.
  inviteProviderToUnit: (
    unitId: string,
    providerId: string,
    data?: { role?: string; service_ids?: string[]; branch_id?: string; service_array_id?: string }
  ) => { ok: boolean; error?: string; affiliationId?: string };
  // Unit types in a brand-new provider not yet on the platform → creates the
  // ProviderProfile and an affiliation in status "unclaimed" (bookable, implicit
  // consent) that the person can later claim and ratify.
  createAndInviteProvider: (
    unitId: string,
    data: {
      provider_type?: ProviderType;
      display_name: string;
      title?: string;
      specialty: string;
      sub_specialties?: string[];
      license_number?: string;
      contact_phone?: string;
      contact_email?: string;
      license_file?: UploadedFile;
      role?: string;
      service_ids?: string[];
      branch_id?: string;
      service_array_id?: string;
    }
  ) => { ok: boolean; error?: string; providerId?: string; affiliationId?: string };
  // Solo provider asks to join a unit → status requested_by_provider.
  requestUnitAffiliation: (
    providerId: string,
    unitId: string,
    data?: { role?: string; service_ids?: string[] }
  ) => { ok: boolean; error?: string; affiliationId?: string };
  // The receiving side responds to a pending invite/request.
  acceptAffiliation: (affiliationId: string) => { ok: boolean; error?: string };
  // Reject a pending invite/request, or the initiator revoking it → declined.
  declineAffiliation: (affiliationId: string) => { ok: boolean; error?: string };
  // Pause / resume an active affiliation (no new bookings while suspended).
  suspendAffiliation: (affiliationId: string) => void;
  reactivateAffiliation: (affiliationId: string) => void;
  // Terminate an active affiliation — BLOCKED while it still has future,
  // non-cancelled appointments (they must be reassigned/cancelled first).
  endAffiliation: (affiliationId: string) => { ok: boolean; error?: string };
  // An unclaimed provider claims their account, ratifying the affiliation.
  claimAffiliation: (affiliationId: string, userId?: string) => { ok: boolean; error?: string };
  // Edit placement / delivered services / the unit-owned in-unit schedule.
  updateAffiliation: (
    affiliationId: string,
    data: Partial<
      Pick<
        ProviderAffiliation,
        | "role"
        | "service_ids"
        | "branch_id"
        | "service_array_id"
        | "schedule_id"
        | "schedule"
        | "schedule_exceptions"
      >
    >
  ) => void;

  // --- Shared resource schedules (§PRV-08, medical units) ------------------
  // A reusable weekly לו״ז defined once and applied to several resources at
  // once. Applying it sets `schedule_id` on the chosen facilities/doctors;
  // deleting one detaches every resource that referenced it. Each resource
  // still books against its own independent queue (see getUnitResources).
  addResourceSchedule: (
    unitId: string,
    data: { name: string; schedule: WeeklySchedule; schedule_exceptions?: ScheduleException[] }
  ) => { ok: boolean; error?: string; scheduleId?: string };
  updateResourceSchedule: (
    unitId: string,
    scheduleId: string,
    data: Partial<Pick<ResourceSchedule, "name" | "schedule" | "schedule_exceptions">>
  ) => void;
  deleteResourceSchedule: (unitId: string, scheduleId: string) => void;
  // Attach a shared schedule to a set of resources (or detach with
  // scheduleId=null). Resources are addressed by facility id / affiliation id.
  applyResourceSchedule: (
    unitId: string,
    scheduleId: string | null,
    targets: { facilityIds?: string[]; doctorAffiliationIds?: string[] }
  ) => void;

  setProviderCommission: (id: string, rate: number) => void;
  setDefaultCommissionRate: (rate: number) => void;
  setServiceTypeCommissionRate: (type: ServiceType, rate: number | undefined) => void;

  addAppointment: (a: Omit<Appointment, "id">) => Appointment;
  updateAppointment: (id: string, data: Partial<Appointment>) => void;
  updateReminderSettings: (data: Partial<ReminderSettings>) => void;

  addOrder: (o: Omit<Order, "id" | "created_date">) => Order;
  updateOrder: (id: string, data: Partial<Order>) => void;

  addLabReferral: (r: Omit<LabReferral, "id" | "created_date">) => LabReferral;
  updateLabReferral: (id: string, data: Partial<LabReferral>) => void;

  addVisitRecord: (v: Omit<VisitRecord, "id" | "created_date">) => VisitRecord;
  updateVisitRecord: (id: string, data: Partial<VisitRecord>) => void;
  addDocument: (d: Omit<PatientDocument, "id" | "created_date">) => PatientDocument;
  updateDocument: (id: string, data: Partial<PatientDocument>) => void;
  deleteDocument: (id: string) => void;

  addWaitlistEntry: (w: Omit<WaitlistEntry, "id" | "created_date" | "status">) => WaitlistEntry;

  addCatalogItem: (c: Omit<CatalogItem, "id">) => CatalogItem;
  updateCatalogItem: (id: string, data: Partial<CatalogItem>) => void;
  deleteCatalogItem: (id: string) => void;
  bulkAddCatalogItems: (items: Omit<CatalogItem, "id">[]) => number;
  // Full Ministry-of-Health price-list import (קטלוג מב"ר) — an official file
  // is re-published periodically, so rows UPSERT by code: an existing מב"ר
  // item with the same code gets its name/prices refreshed, a new code is
  // added. Returns how many of each.
  importMohPriceList: (
    rows: Array<{
      tavar_code: string;
      name_he: string;
      skill_domain_id: string;
      skill_subdomain_id: string;
      service_type: ServiceType;
      price_s: number;
      price_h: number;
      typical_duration_min?: number;
      requires_referral: boolean;
    }>
  ) => { added: number; updated: number };
  bulkDeleteCatalogItems: (ids: string[]) => void;
  bulkSetCatalogItemsActive: (ids: string[], is_active: boolean) => void;

  // Catalog requests (provider asks Ops to add a missing Healson item).
  addCatalogRequest: (
    input: Omit<CatalogRequest, "id" | "status" | "created_date" | "resolved_at" | "admin_note" | "resolved_item_id">
  ) => CatalogRequest;
  approveCatalogRequestAsItem: (id: string, values: Omit<CatalogItem, "id">) => CatalogItem;
  mergeCatalogRequest: (id: string, existingItemId: string) => void;
  rejectCatalogRequest: (id: string, note: string) => void;
  requestCatalogRequestInfo: (id: string, note: string) => void;

  bulkAddProviders: (items: Omit<ProviderProfile, "id" | "created_date">[]) => number;

  addSkillDomain: (d: Omit<SkillDomain, "id">) => SkillDomain;
  updateSkillDomain: (id: string, data: Partial<SkillDomain>) => void;
  deleteSkillDomain: (id: string) => void;
  addSkillSubdomain: (s: Omit<SkillSubdomain, "id">) => SkillSubdomain;
  updateSkillSubdomain: (id: string, data: Partial<SkillSubdomain>) => void;
  deleteSkillSubdomain: (id: string) => void;

  grantConsent: (patientId: string, type: ConsentType, version?: string) => ConsentRecord;
  revokeConsent: (recordId: string) => void;
  getPatientConsents: (patientId: string) => ConsentRecord[];

  addDsrRequest: (r: Omit<DsrRequest, "id" | "requested_at" | "status"> & { status?: DsrRequestStatus }) => DsrRequest;
  updateDsrRequest: (id: string, data: Partial<DsrRequest>) => void;
  exportPatientData: (patientId: string) => Record<string, unknown> | null;

  reportOtpIssue: (channel: OtpIssueChannel, contact: string, context: OtpIssueContext) => OtpIssueReport;
  updateOtpIssueReport: (id: string, data: Partial<OtpIssueReport>) => void;
}

interface HydrationState {
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
}

type Store = AuthState & ToastState & EntitiesState & HydrationState;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // ---------------- Hydration ----------------
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      // ---------------- Auth ----------------
      currentUser: null,
      pendingRegistration: null,
      pendingProviderSubmission: null,
      pendingLoginVerification: null,
      pendingReauth: null,
      pendingRegistrationVerification: null,
      pendingPasswordReset: null,

      login: (email, password) => {
        if (!email || !password) return { ok: false, error: "נא להזין אימייל וסיסמה" };
        const existing = get().users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (existing) {
          if (existing.role === "provider") {
            const provider = get().providers.find((p) => p.user_id === existing.id);
            // pending_review no longer blocks login (PROV-REGISTRATION) — the
            // provider already has a session from registerProviderAccount and
            // ProviderLayout routes them to /provider/register to finish or await review.
            if (provider?.status === "rejected") {
              return {
                ok: false,
                blockedStatus: "rejected",
                error: provider.rejection_reason
                  ? `בקשתך נדחתה: ${provider.rejection_reason}`
                  : "בקשתך להצטרפות נדחתה.",
              };
            }
            if (provider?.status === "suspended") {
              return { ok: false, blockedStatus: "suspended", error: "חשבון הספק מושהה זמנית. אנא פנה לתמיכה." };
            }
          }
          // Policy: an existing patient (already has a Patient record, i.e.
          // finished registration) must clear a 2FA step-up — password
          // (factor 1) + one OTP (factor 2) — before the personal area
          // unlocks. The code is sent to both SMS and email at once purely
          // for delivery redundancy, not as two separate gates like
          // registration's identity-proofing double-OTP. Demo-only: the
          // code is fixed, nothing is actually sent.
          const isExistingPatient =
            existing.role === "patient" && get().patients.some((p) => p.user_id === existing.id);
          if (isExistingPatient) {
            set({ pendingLoginVerification: { userId: existing.id, otp: "123456" } });
            return { ok: true, requiresOtp: true };
          }
          set({ currentUser: existing });
          return { ok: true };
        }
        // No User account yet — but a Patient record with this email may
        // already exist (e.g. added by staff, never logged in online
        // before). Treat that the same as an existing patient — link a
        // User to it and require the double OTP — instead of silently
        // spinning up a second, blank lead account for the same person.
        const matchingPatient = get().patients.find(
          (p) => p.email && p.email.toLowerCase() === email.toLowerCase()
        );
        if (matchingPatient) {
          const linkedUser: User = {
            id: generateId("user"),
            email,
            full_name: matchingPatient.full_name,
            role: "patient",
            phone: matchingPatient.phone,
            created_date: new Date().toISOString(),
          };
          set((s) => ({ users: [...s.users, linkedUser] }));
          if (!matchingPatient.user_id) {
            get().updatePatient(matchingPatient.id, { user_id: linkedUser.id });
          }
          set({ pendingLoginVerification: { userId: linkedUser.id, otp: "123456" } });
          return { ok: true, requiresOtp: true };
        }
        // Truly unknown email -> mock-create a new patient account on the fly.
        const newUser: User = {
          id: generateId("user"),
          email,
          full_name: email.split("@")[0],
          role: "patient",
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, newUser], currentUser: newUser }));
        get().addPatient({
          full_name: newUser.full_name,
          email: newUser.email,
          kupah: "כללית",
          status: "פעיל",
          user_id: newUser.id,
        });
        return { ok: true };
      },

      // Demo-only "Continue with Google" SSO shortcut for a NEW provider.
      // Creates (or resets, on repeat clicks) a fresh provider account and logs
      // it in, exactly like registerProviderAccount — but with a Google
      // identity instead of an email/password form. It lands in `pending_review`
      // with a BARE profile (no type/documents yet), so the caller sends the
      // provider into the in-portal application (/provider/register) to choose
      // their provider type, upload documents and submit for review — the same
      // request stage every provider goes through, before onboarding. Idempotent
      // by fixed id, same reset technique as the "new patient" demo above.
      loginWithGoogle: () => {
        const GOOGLE_PROVIDER_ID = "user_google_provider";
        // Google returns a verified email + name, but never a phone number.
        // So no `phone` here — the applicant enters it (required) in the
        // application form, and it's verified there via OTP at submit. Faking
        // one would leave a "phantom" phone that was never actually verified.
        const user: User = {
          id: GOOGLE_PROVIDER_ID,
          email: "google.provider@demo.co.il",
          full_name: 'ישראל ישראלי',
          role: "provider",
          created_date: new Date().toISOString(),
        };
        set((s) => ({
          users: [...s.users.filter((u) => u.id !== GOOGLE_PROVIDER_ID), user],
          providers: s.providers.filter((p) => p.user_id !== GOOGLE_PROVIDER_ID),
          currentUser: user,
        }));
        get().upsertProviderProfile(GOOGLE_PROVIDER_ID, { display_name: user.full_name });
      },

      loginAsDemo: (role, patientVariant) => {
        if (role === "patient" && patientVariant === "new") {
          // Reset the demo "new patient" account to a pristine lead on every
          // click — otherwise completing registration once (which links a
          // Patient record and overwrites the name/phone on this fixed demo
          // id) would permanently turn it into an "existing patient" for
          // every future demo run, making the lead flow undemonstrable.
          set((s) => ({
            users: s.users.map((u) => (u.id === DEMO_NEW_PATIENT_USER.id ? { ...DEMO_NEW_PATIENT_USER } : u)),
            patients: s.patients.filter((p) => p.user_id !== DEMO_NEW_PATIENT_USER.id),
            currentUser: { ...DEMO_NEW_PATIENT_USER },
          }));
          return;
        }
        const user = get().users.find((u) => u.role === role) ?? null;
        // Demo shortcut for an existing patient still has to clear the
        // 2FA gate, same as the real login form — otherwise the wireframe
        // would show the policy inconsistently to whoever is running the demo.
        if (user && role === "patient" && get().patients.some((p) => p.user_id === user.id)) {
          set({ pendingLoginVerification: { userId: user.id, otp: "123456" } });
          return;
        }
        set({ currentUser: user });
      },

      loginAsDemoUser: (userId) => {
        const user = get().users.find((u) => u.id === userId);
        if (!user) return false;
        set({ currentUser: user });
        return true;
      },

      updateCurrentUserDetails: (data) => {
        const current = get().currentUser;
        if (!current) return;
        const next: User = {
          ...current,
          ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
        };
        set((s) => ({
          currentUser: next,
          users: s.users.map((u) => (u.id === next.id ? next : u)),
        }));
      },

      verifyLoginOtp: (code) => {
        const pending = get().pendingLoginVerification;
        if (!pending) return { ok: false, error: "לא נמצא תהליך אימות פעיל" };
        if (code !== pending.otp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        const user = get().users.find((u) => u.id === pending.userId) ?? null;
        set({ currentUser: user, pendingLoginVerification: null });
        return { ok: true };
      },

      resendLoginOtp: () => {
        const pending = get().pendingLoginVerification;
        return pending ? pending.otp : null;
      },

      beginReauth: () => {
        const otp = "123456";
        set({ pendingReauth: { otp } });
        return otp;
      },
      verifyReauthOtp: (code) => {
        const pending = get().pendingReauth;
        if (!pending) return { ok: false, error: "לא נמצא תהליך אימות פעיל" };
        if (code !== pending.otp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        set({ pendingReauth: null });
        return { ok: true };
      },
      resendReauthOtp: () => {
        const pending = get().pendingReauth;
        return pending ? pending.otp : null;
      },

      // Policy: a new patient must also clear the SMS+email double OTP —
      // as the very last step, right before they become a registered
      // patient — same as the step-up an existing patient clears at login.
      // Demo-only: fixed codes, nothing is actually sent.
      beginRegistrationVerification: () => {
        set({
          pendingRegistrationVerification: { smsOtp: "123456", smsVerified: false },
        });
      },

      resetRegistrationVerification: () => {
        set({ pendingRegistrationVerification: null });
      },

      verifyRegistrationSmsOtp: (code) => {
        const pending = get().pendingRegistrationVerification;
        if (!pending) return { ok: false, error: "לא נמצא תהליך אימות פעיל" };
        if (code !== pending.smsOtp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        set({ pendingRegistrationVerification: { ...pending, smsVerified: true } });
        return { ok: true };
      },

      // Called when the user clicks the (simulated) confirmation link — no
      // code to check, so the only failure mode is skipping ahead of SMS.
      verifyRegistrationEmailLink: () => {
        const pending = get().pendingRegistrationVerification;
        if (!pending || !pending.smsVerified) {
          return { ok: false, error: "יש לאמת קודם את הקוד שנשלח ב-SMS" };
        }
        set({ pendingRegistrationVerification: null });
        return { ok: true };
      },

      resendRegistrationOtp: (channel) => {
        const pending = get().pendingRegistrationVerification;
        if (!pending) return null;
        // "email" has no code to hand back — the non-null return is just a
        // sent-successfully signal for the caller's toast.
        return channel === "sms" ? pending.smsOtp : "sent";
      },

      register: (email, password) => {
        const otp = "123456";
        set({ pendingRegistration: { email, password, otp } });
        return { ok: true, otpHint: otp };
      },

      verifyOtp: (email, code) => {
        const pending = get().pendingRegistration;
        if (!pending || pending.email !== email) {
          return { ok: false, error: "לא נמצאה הרשמה פעילה" };
        }
        if (code !== pending.otp) {
          return { ok: false, error: "קוד שגוי, נסה שנית" };
        }
        const newUser: User = {
          id: generateId("user"),
          email: pending.email,
          full_name: pending.email.split("@")[0],
          role: "patient",
          created_date: new Date().toISOString(),
        };
        set((s) => ({
          users: [...s.users, newUser],
          currentUser: newUser,
          pendingRegistration: null,
        }));
        // Note: the Patient record (insurance profile + consent) is created
        // afterwards via completePatientRegistration, once the multi-step
        // /register flow collects those fields (§4.2).
        return { ok: true };
      },

      resendOtp: () => {
        const pending = get().pendingRegistration;
        return pending ? pending.otp : null;
      },

      registerProviderAccount: (full_name, phone, email, password, providerType) => {
        void password; // mocked — no real auth/password storage anywhere in this app (see login())
        const emailTaken = get().users.some((u) => u.email.toLowerCase() === email.toLowerCase());
        if (emailTaken) return { ok: false, error: "כתובת האימייל כבר רשומה במערכת" };
        const newUser: User = {
          id: generateId("user"),
          email,
          full_name,
          phone,
          role: "provider",
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, newUser] }));
        // Everything that comes through the public join flow is on the "solo"
        // path by definition — a medical unit never reaches this action, its
        // user is opened by Ops (addOrganizationUnit + createProviderUnitUser).
        // provider_type is already known (picked on /apply, step 1) — mirrors
        // ProviderTypePicker's own seeding: for an individual the display name
        // IS the account holder's name, for an organization it names the
        // business, so the person's name moves to the contact field instead.
        const isPerson = !providerType || providerType === "doctor" || providerType === "caregiver";
        const profile = get().upsertProviderProfile(newUser.id, {
          provider_type: providerType,
          display_name: isPerson ? full_name : "",
          contact_name: isPerson ? undefined : full_name,
          onboarding_path: "solo",
        });
        // Logged in immediately (PROV-REGISTRATION) — unlike the old
        // apply-then-wait-for-Ops flow, the applicant gets a real session the
        // moment their account exists, and continues straight into phone +
        // email verification, then the rest of the application, on
        // /provider/register while already authenticated — mirroring
        // register()/verifyOtp() for patients.
        set({ currentUser: newUser });
        return { ok: true, providerId: profile.id };
      },

      beginProviderVerification: (providerId) => {
        const provider = get().providers.find((p) => p.id === providerId);
        if (!provider) return { ok: false, error: "לא נמצא פרופיל ספק" };
        const otp = "123456";
        set({ pendingProviderSubmission: { providerId, otp } });
        return { ok: true, otpHint: otp };
      },

      verifyProviderPhoneOtp: (code) => {
        const pending = get().pendingProviderSubmission;
        if (!pending) return { ok: false, error: "לא נמצא תהליך אימות פעיל" };
        if (code !== pending.otp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        get().updateProviderById(pending.providerId, { phone_verified_at: new Date().toISOString() });
        set({ pendingProviderSubmission: null });
        return { ok: true, providerId: pending.providerId };
      },

      resendProviderPhoneOtp: () => {
        const pending = get().pendingProviderSubmission;
        return pending ? pending.otp : null;
      },

      finalizeProviderApplication: (providerId) => {
        const provider = get().providers.find((p) => p.id === providerId);
        if (!provider) return { ok: false, error: "לא נמצא פרופיל ספק" };
        const licenseTaken =
          !!provider.license_number &&
          get().providers.some(
            (p) => p.id !== providerId && p.status !== "rejected" && p.license_number === provider.license_number
          );
        if (licenseTaken) return { ok: false, error: "מספר הרישיון כבר רשום במערכת" };
        get().updateProviderById(providerId, { application_submitted_at: new Date().toISOString() });
        return { ok: true };
      },

      // Demo-only: fixed codes, nothing is actually sent. Unlike the
      // registration duplicate-ID check (which stays generic to avoid
      // account enumeration), this *does* say plainly when there's no
      // matching account/phone — this is a demo meant to be understandable
      // to whoever's testing it, not a hardened endpoint fending off real
      // attackers probing which emails are registered. A production build
      // would want the generic "if this account exists…" wording instead.
      forgotPassword: (contact, loginPath = "/login") => {
        const matchedUser = get().users.find((u) => u.email.toLowerCase() === contact.trim().toLowerCase());
        if (!matchedUser) return { ok: false, error: "לא נמצא חשבון עם כתובת אימייל זו" };
        const matchedPatient = get().patients.find((p) => p.user_id === matchedUser.id);
        const phone = matchedPatient?.phone ?? matchedUser.phone;
        if (!phone) return { ok: false, error: "לא נמצא מספר טלפון המשויך לחשבון זה" };
        const smsOtp = "123456";
        set({
          pendingPasswordReset: {
            contact,
            loginPath,
            maskedPhone: maskPhone(phone),
            smsOtp,
            smsVerified: false,
            verified: false,
          },
        });
        return { ok: true, otpHint: smsOtp };
      },
      verifyPasswordResetSmsOtp: (code) => {
        const pending = get().pendingPasswordReset;
        if (!pending) return { ok: false, error: "לא נמצא תהליך איפוס פעיל" };
        if (code !== pending.smsOtp) return { ok: false, error: "קוד שגוי, נסה שנית" };
        set({ pendingPasswordReset: { ...pending, smsVerified: true } });
        return { ok: true };
      },
      // Called when the user clicks the (simulated) confirmation link — no
      // code to check, so the only failure mode is skipping ahead of SMS.
      verifyPasswordResetEmailLink: () => {
        const pending = get().pendingPasswordReset;
        if (!pending || !pending.smsVerified) {
          return { ok: false, error: "יש לאמת קודם את הקוד שנשלח ב-SMS" };
        }
        set({ pendingPasswordReset: { ...pending, verified: true } });
        return { ok: true };
      },
      resendPasswordResetOtp: (channel) => {
        const pending = get().pendingPasswordReset;
        if (!pending) return null;
        // "email" has no code to hand back — the non-null return is just a
        // sent-successfully signal for the caller's toast.
        return channel === "sms" ? pending.smsOtp : "sent";
      },
      resetPassword: (newPassword) => {
        void newPassword; // mocked — no real password storage anywhere in this app (see login())
        const pending = get().pendingPasswordReset;
        if (!pending || !pending.verified) {
          return { ok: false, error: "יש לאמת קוד לפני איפוס הסיסמה" };
        }
        set({ pendingPasswordReset: null });
        return { ok: true };
      },

      logout: () => set({ currentUser: null }),

      completePatientRegistration: (userId, data, consents) => {
        set((s) => ({
          users: s.users.map((u) =>
            u.id === userId ? { ...u, full_name: data.full_name || u.full_name, phone: data.phone ?? u.phone } : u
          ),
        }));
        const user = get().users.find((u) => u.id === userId);
        const patient = get().addPatient({
          full_name: data.full_name,
          email: user?.email,
          phone: data.phone,
          id_number: data.id_number,
          id_document_type: data.id_document_type,
          id_document_photo: data.id_document_photo,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          parent_name: data.parent_name,
          address: data.address,
          kupah: data.kupah,
          k_level: data.k_level,
          b_insurances: data.b_insurances,
          status: "פעיל",
          user_id: userId,
        });
        (Object.keys(consents) as ConsentType[]).forEach((type) => {
          if (consents[type]) get().grantConsent(patient.id, type, CONSENT_DOCUMENT_VERSION);
        });
        return patient;
      },

      // ---------------- Toasts ----------------
      toasts: [],
      showToast: (title, opts) => {
        const id = generateId("toast");
        set((s) => ({
          toasts: [...s.toasts, { id, title, description: opts?.description, variant: opts?.variant ?? "default" }],
        }));
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 3500);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      // ---------------- Entities ----------------
      users: SEED_USERS,
      patients: SEED_PATIENTS,
      leads: SEED_LEADS,
      providers: SEED_PROVIDERS,
      organizationBranches: SEED_ORGANIZATION_BRANCHES,
      serviceArrays: SEED_SERVICE_ARRAYS,
      affiliations: SEED_AFFILIATIONS,
      catalog: SEED_CATALOG,
      catalogRequests: SEED_CATALOG_REQUESTS,
      skillDomains: SEED_SKILL_DOMAINS,
      skillSubdomains: SEED_SKILL_SUBDOMAINS,
      appointments: SEED_APPOINTMENTS,
      orders: SEED_ORDERS,
      labReferrals: SEED_LAB_REFERRALS,
      visitRecords: SEED_VISIT_RECORDS,
      documents: SEED_DOCUMENTS,
      waitlist: [],
      branches: SEED_BRANCHES,
      consentRecords: SEED_CONSENT_RECORDS,
      dsrRequests: SEED_DSR_REQUESTS,
      otpIssueReports: [],
      defaultCommissionRate: 15,
      commissionRateByServiceType: {},
      reminderSettings: DEFAULT_REMINDER_SETTINGS,

      addPatient: (p) => {
        const record: Patient = { ...p, id: generateId("pat"), created_date: new Date().toISOString() };
        set((s) => ({ patients: [record, ...s.patients] }));
        return record;
      },
      updatePatient: (id, data) =>
        set((s) => ({ patients: s.patients.map((p) => (p.id === id ? { ...p, ...data } : p)) })),
      deletePatient: (id) => set((s) => ({ patients: s.patients.filter((p) => p.id !== id) })),

      addLead: (l) => {
        const record: Lead = { ...l, id: generateId("lead"), created_date: new Date().toISOString() };
        set((s) => ({ leads: [record, ...s.leads] }));
        return record;
      },
      updateLead: (id, data) =>
        set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, ...data } : l)) })),
      deleteLead: (id) => set((s) => ({ leads: s.leads.filter((l) => l.id !== id) })),
      convertLead: (id) => {
        const lead = get().leads.find((l) => l.id === id);
        if (!lead) return undefined;
        const patient = get().addPatient({
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          kupah: "כללית",
          status: "פעיל",
        });
        get().updateLead(id, { status: "הומר", conversion_date: new Date().toISOString() });
        return patient;
      },

      addAdminUser: (data) => {
        const record: User = {
          id: generateId("user"),
          email: data.email,
          full_name: data.full_name,
          phone: data.phone,
          role: "admin",
          admin_title: "support_rep",
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, record] }));
        return record;
      },

      addBranch: (data) => {
        const record: Branch = { id: generateId("branch"), ...data };
        set((s) => ({ branches: [...s.branches, record] }));
        return record;
      },
      deleteBranch: (id) => set((s) => ({ branches: s.branches.filter((b) => b.id !== id) })),

      updateProviderById: (id, data) =>
        set((s) => ({
          providers: s.providers.map((p) => {
            if (p.id !== id) return p;
            const updated = { ...p, ...data };
            // Providers can only be published when fully approved. Keep the
            // model consistent even if a write path accidentally toggles
            // is_published while the provider is pending review or onboarding.
            if (updated.status !== "approved") {
              updated.is_published = false;
            }
            // Onboarding readiness (FEAT-06) is derived, not set by any single
            // screen — recompute it here so every write path (agreements,
            // catalog, calendars, linking, sign) stays in sync automatically.
            // Requires calendars ("יומנים") to exist AND at least one service
            // actually linked to one — a service defined before any calendar
            // exists doesn't count (see ServiceCatalogSection/PriceListSection's
            // "add a calendar first" flag).
            const allServices = [...updated.consultation_types, ...updated.exam_types];
            if (
              updated.status === "onboarding" &&
              !updated.onboarding_ready_at &&
              updated.agreements.length > 0 &&
              allServices.length > 0 &&
              updated.clinic_locations.length > 0 &&
              allServices.some((sv) => (sv.linked_clinic_ids?.length ?? 0) > 0) &&
              updated.agreement_signed_at
            ) {
              updated.onboarding_ready_at = new Date().toISOString();
            }
            return updated;
          }),
        })),

      verifyProviderLicense: (id) => {
        // No new credential is issued here (PROV-REGISTRATION) — the
        // provider already has their own account/session from
        // registerProviderAccount, so this just unlocks onboarding access.
        get().updateProviderById(id, {
          status: "onboarding",
          license_verified_at: new Date().toISOString(),
        });
      },
      // Demo shortcut (product-demo flow) — skips the real Ops license-review
      // + Go-Live pipeline entirely, dropping the applicant straight into
      // their own /provider/dashboard fully approved+published so they can
      // self-serve the rest of the setup (catalog/locations/availability).
      demoApproveProvider: (id) => {
        const provider = get().providers.find((p) => p.id === id);
        get().updateProviderById(id, {
          status: "approved",
          is_published: true,
          license_verified_at: new Date().toISOString(),
          rejection_reason: undefined,
        });
        const user = provider?.user_id ? get().users.find((u) => u.id === provider.user_id) : undefined;
        if (user) set({ currentUser: user });
      },
      demoRejectProvider: (id, reason) => {
        get().updateProviderById(id, {
          status: "rejected",
          rejection_reason: reason ?? "לצורך ההדגמה, צוות Healson דחה את הבקשה — נמצאו פערים במסמכים שצורפו.",
          is_published: false,
        });
      },
      rejectProvider: (id, reason) => {
        get().updateProviderById(id, { status: "rejected", rejection_reason: reason, is_published: false });
      },
      requestProviderChanges: (id, reason) => {
        get().updateProviderById(id, {
          status: "onboarding",
          rejection_reason: reason,
          onboarding_ready_at: undefined,
          go_live_requested_at: undefined,
        });
      },
      // Provider clicks "פרסם" once onboarding is complete — this only
      // queues the request; Healson still has to manually approve Go-Live
      // (approveProviderGoLive) before status/is_published actually change.
      requestProviderGoLive: (id) => {
        get().updateProviderById(id, { go_live_requested_at: new Date().toISOString() });
      },
      approveProviderGoLive: (id) => {
        get().updateProviderById(id, { status: "approved", is_published: true, rejection_reason: undefined });
      },
      suspendProvider: (id) => get().updateProviderById(id, { status: "suspended" }),
      reinstateProvider: (id) => get().updateProviderById(id, { status: "approved" }),
      signProviderAgreement: (id) => get().updateProviderById(id, { agreement_signed_at: new Date().toISOString() }),

      // --- Affiliated doctors -------------------------------------------
      findMatchingDoctors: (query) => {
        const norm = (v?: string) => (v ?? "").trim().toLowerCase();
        const digits = (v?: string) => (v ?? "").replace(/\D/g, "");
        const license = norm(query.license_number);
        const phone = digits(query.phone);
        const email = norm(query.email);
        const name = norm(query.full_name);
        if (!license && !phone && !email && !name) return [];
        return get().providers.filter((p) => {
          if (p.provider_type && p.provider_type !== "doctor") return false;
          // License number is the authoritative identifier; phone/email are
          // strong signals; an exact name match is the weakest but still worth
          // surfacing so the user can confirm rather than duplicate.
          if (license && norm(p.license_number) === license) return true;
          if (phone && (digits(p.contact_phone) === phone || digits(p.user_id ? get().users.find((u) => u.id === p.user_id)?.phone : undefined) === phone)) {
            return true;
          }
          if (email && norm(p.contact_email) === email) return true;
          if (name && norm(p.display_name) === name) return true;
          return false;
        });
      },

      searchDoctors: (query) => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        const digits = q.replace(/\D/g, "");
        return get()
          .providers.filter((p) => !p.provider_type || p.provider_type === "doctor")
          .filter((p) => {
            const haystack = [p.display_name, p.license_number, p.specialty, p.contact_email]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (haystack.includes(q)) return true;
            return digits.length >= 3 && (p.contact_phone ?? "").replace(/\D/g, "").includes(digits);
          })
          .slice(0, 20);
      },

      addAffiliatedDoctor: (organizationId, data) => {
        const org = get().providers.find((p) => p.id === organizationId);
        if (!org) return { ok: false, error: "הארגון לא נמצא" };
        if (data.license_number) {
          const clash = get().providers.find(
            (p) => p.license_number && p.license_number.trim() === data.license_number!.trim()
          );
          if (clash) {
            return {
              ok: false,
              error: `מספר הרישיון ${data.license_number} כבר רשום במערכת עבור ${clash.display_name}. יש לשייך את נותן/ת השירות הקיים/ת במקום ליצור רשומה חדשה.`,
            };
          }
        }
        // A doctor added by an organization is a real doctor record in the
        // platform — created in pending_review so Ops still verify the license
        // exactly as they would for a self-registered doctor.
        const doctor: ProviderProfile = {
          id: generateId("prov"),
          provider_type: "doctor",
          display_name: data.display_name,
          title: data.title,
          specialty: data.specialty,
          sub_specialties: data.sub_specialties,
          license_number: data.license_number,
          contact_phone: data.contact_phone,
          contact_email: data.contact_email,
          license_file: data.license_file,
          doctor_subtype: "physician",
          is_published: false,
          status: "pending_review",
          organization_provider_ids: [organizationId],
          agreements: [],
          consultation_types: [],
          exam_types: [],
          clinic_locations: [],
          referral_forms: [],
          created_date: new Date().toISOString(),
        };
        set((s) => ({ providers: [...s.providers, doctor] }));
        get().linkExistingDoctorToOrganization(organizationId, doctor.id, {
          role: data.role,
          service_ids: data.service_ids,
          clinic_ids: data.clinic_ids,
        });
        return { ok: true, doctorId: doctor.id };
      },

      linkExistingDoctorToOrganization: (organizationId, doctorProviderId, data) => {
        const org = get().providers.find((p) => p.id === organizationId);
        const doctor = get().providers.find((p) => p.id === doctorProviderId);
        if (!org || !doctor) return { ok: false, error: "לא נמצאה רשומת נותן/ת שירות לשיוך" };
        if ((org.affiliated_doctors ?? []).some((a) => a.doctor_provider_id === doctorProviderId)) {
          return { ok: false, error: `${doctor.display_name} כבר משויך/ת לארגון` };
        }
        const affiliation: AffiliatedDoctor = {
          id: generateId("affdoc"),
          doctor_provider_id: doctorProviderId,
          role: data?.role,
          service_ids: data?.service_ids ?? [],
          clinic_ids: data?.clinic_ids ?? [],
          added_at: new Date().toISOString(),
        };
        get().updateProviderById(organizationId, {
          affiliated_doctors: [...(org.affiliated_doctors ?? []), affiliation],
        });
        // Keep the inverse link on the doctor in sync so their own profile can
        // show where they practice.
        get().updateProviderById(doctorProviderId, {
          organization_provider_ids: [
            ...new Set([...(doctor.organization_provider_ids ?? []), organizationId]),
          ],
        });
        return { ok: true };
      },

      updateAffiliatedDoctor: (organizationId, affiliationId, data) => {
        const org = get().providers.find((p) => p.id === organizationId);
        if (!org) return;
        get().updateProviderById(organizationId, {
          affiliated_doctors: (org.affiliated_doctors ?? []).map((a) =>
            a.id === affiliationId ? { ...a, ...data } : a
          ),
        });
      },

      removeAffiliatedDoctor: (organizationId, affiliationId) => {
        const org = get().providers.find((p) => p.id === organizationId);
        if (!org) return;
        const affiliation = (org.affiliated_doctors ?? []).find((a) => a.id === affiliationId);
        get().updateProviderById(organizationId, {
          affiliated_doctors: (org.affiliated_doctors ?? []).filter((a) => a.id !== affiliationId),
        });
        // Unlink the inverse reference, but never delete the doctor record —
        // they may be affiliated with other organizations, or stand alone.
        if (affiliation) {
          const doctor = get().providers.find((p) => p.id === affiliation.doctor_provider_id);
          if (doctor) {
            get().updateProviderById(doctor.id, {
              organization_provider_ids: (doctor.organization_provider_ids ?? []).filter(
                (id) => id !== organizationId
              ),
            });
          }
        }
      },

      // --- Provider ⇄ unit affiliations (§PRV-10) -------------------------
      inviteProviderToUnit: (unitId, providerId, data) => {
        const unit = get().providers.find((p) => p.id === unitId);
        const provider = get().providers.find((p) => p.id === providerId);
        if (!unit || !provider) return { ok: false, error: "לא נמצאה יחידה או נותן/ת שירות לשיוך" };
        const clash = get().affiliations.find(
          (a) =>
            a.provider_id === providerId &&
            a.unit_id === unitId &&
            a.status !== "declined" &&
            a.status !== "ended"
        );
        if (clash) return { ok: false, error: `${provider.display_name} כבר משויך/ת ליחידה או ממתין/ה לאישור` };
        const now = new Date().toISOString();
        const affiliation: ProviderAffiliation = {
          id: generateId("affil"),
          provider_id: providerId,
          unit_id: unitId,
          role: data?.role,
          service_ids: data?.service_ids ?? [],
          branch_id: data?.branch_id,
          service_array_id: data?.service_array_id,
          status: "invited_by_unit",
          initiated_by: "unit",
          requested_at: now,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ affiliations: [...s.affiliations, affiliation] }));
        return { ok: true, affiliationId: affiliation.id };
      },

      createAndInviteProvider: (unitId, data) => {
        const unit = get().providers.find((p) => p.id === unitId);
        if (!unit) return { ok: false, error: "היחידה לא נמצאה" };
        if (data.license_number) {
          const clash = get().providers.find(
            (p) => p.license_number && p.license_number.trim() === data.license_number!.trim()
          );
          if (clash) {
            return {
              ok: false,
              error: `מספר הרישיון ${data.license_number} כבר רשום במערכת עבור ${clash.display_name}. יש לשייך את נותן/ת השירות הקיים/ת במקום ליצור רשומה חדשה.`,
            };
          }
        }
        const now = new Date().toISOString();
        const type = data.provider_type ?? "doctor";
        const provider: ProviderProfile = {
          id: generateId("prov"),
          provider_type: type,
          display_name: data.display_name,
          title: data.title,
          specialty: data.specialty,
          sub_specialties: data.sub_specialties,
          license_number: data.license_number,
          contact_phone: data.contact_phone,
          contact_email: data.contact_email,
          license_file: data.license_file,
          doctor_subtype: type === "doctor" ? "physician" : undefined,
          is_published: false,
          status: "pending_review",
          agreements: [],
          consultation_types: [],
          exam_types: [],
          clinic_locations: [],
          referral_forms: [],
          created_date: now,
        };
        const affiliation: ProviderAffiliation = {
          id: generateId("affil"),
          provider_id: provider.id,
          unit_id: unitId,
          role: data.role,
          service_ids: data.service_ids ?? [],
          branch_id: data.branch_id,
          service_array_id: data.service_array_id,
          // The person isn't on the platform yet, so no consent handshake is
          // possible — the affiliation is live with implicit consent until they
          // claim their account and ratify it.
          status: "unclaimed",
          initiated_by: "unit",
          requested_at: now,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({
          providers: [...s.providers, provider],
          affiliations: [...s.affiliations, affiliation],
        }));
        return { ok: true, providerId: provider.id, affiliationId: affiliation.id };
      },

      requestUnitAffiliation: (providerId, unitId, data) => {
        const unit = get().providers.find((p) => p.id === unitId);
        const provider = get().providers.find((p) => p.id === providerId);
        if (!unit || !provider) return { ok: false, error: "לא נמצאה יחידה או נותן/ת שירות" };
        const clash = get().affiliations.find(
          (a) =>
            a.provider_id === providerId &&
            a.unit_id === unitId &&
            a.status !== "declined" &&
            a.status !== "ended"
        );
        if (clash) return { ok: false, error: "כבר קיימת בקשת שיוך או שיוך פעיל ליחידה זו" };
        const now = new Date().toISOString();
        const affiliation: ProviderAffiliation = {
          id: generateId("affil"),
          provider_id: providerId,
          unit_id: unitId,
          role: data?.role,
          service_ids: data?.service_ids ?? [],
          status: "requested_by_provider",
          initiated_by: "provider",
          requested_at: now,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ affiliations: [...s.affiliations, affiliation] }));
        return { ok: true, affiliationId: affiliation.id };
      },

      acceptAffiliation: (affiliationId) => {
        const a = get().affiliations.find((x) => x.id === affiliationId);
        if (!a) return { ok: false, error: "השיוך לא נמצא" };
        if (a.status !== "invited_by_unit" && a.status !== "requested_by_provider") {
          return { ok: false, error: "אין בקשה ממתינה לאישור" };
        }
        const now = new Date().toISOString();
        set((s) => ({
          affiliations: s.affiliations.map((x) =>
            x.id === affiliationId ? { ...x, status: "active", decided_at: now, updated_at: now } : x
          ),
        }));
        return { ok: true };
      },

      declineAffiliation: (affiliationId) => {
        const a = get().affiliations.find((x) => x.id === affiliationId);
        if (!a) return { ok: false, error: "השיוך לא נמצא" };
        if (a.status !== "invited_by_unit" && a.status !== "requested_by_provider") {
          return { ok: false, error: "אין בקשה ממתינה לדחייה" };
        }
        const now = new Date().toISOString();
        set((s) => ({
          affiliations: s.affiliations.map((x) =>
            x.id === affiliationId ? { ...x, status: "declined", decided_at: now, updated_at: now } : x
          ),
        }));
        return { ok: true };
      },

      suspendAffiliation: (affiliationId) => {
        const now = new Date().toISOString();
        set((s) => ({
          affiliations: s.affiliations.map((x) =>
            x.id === affiliationId && x.status === "active"
              ? { ...x, status: "suspended", updated_at: now }
              : x
          ),
        }));
      },

      reactivateAffiliation: (affiliationId) => {
        const now = new Date().toISOString();
        set((s) => ({
          affiliations: s.affiliations.map((x) =>
            x.id === affiliationId && x.status === "suspended"
              ? { ...x, status: "active", updated_at: now }
              : x
          ),
        }));
      },

      endAffiliation: (affiliationId) => {
        const a = get().affiliations.find((x) => x.id === affiliationId);
        if (!a) return { ok: false, error: "השיוך לא נמצא" };
        // Product rule (§PRV-10.5): can't end an affiliation that still owes the
        // unit future work — a resource_id equal to this affiliation id is a
        // booking delivered by this provider inside the unit.
        const today = new Date().toISOString().slice(0, 10);
        const future = get().appointments.filter(
          (ap) =>
            ap.resource_id === affiliationId &&
            ap.status !== "בוטל" &&
            ap.status !== "בוצע" &&
            ap.date >= today
        );
        if (future.length > 0) {
          return {
            ok: false,
            error: `לא ניתן לסיים את השיוך: קיימים ${future.length} תורים עתידיים. יש לשבץ אותם מחדש או לבטלם תחילה.`,
          };
        }
        const now = new Date().toISOString();
        set((s) => ({
          affiliations: s.affiliations.map((x) =>
            x.id === affiliationId ? { ...x, status: "ended", ended_at: now, updated_at: now } : x
          ),
        }));
        return { ok: true };
      },

      claimAffiliation: (affiliationId, userId) => {
        const a = get().affiliations.find((x) => x.id === affiliationId);
        if (!a) return { ok: false, error: "השיוך לא נמצא" };
        if (a.status !== "unclaimed") return { ok: false, error: "השיוך אינו במצב הממתין לתביעה" };
        const now = new Date().toISOString();
        set((s) => ({
          affiliations: s.affiliations.map((x) =>
            x.id === affiliationId ? { ...x, status: "active", decided_at: now, updated_at: now } : x
          ),
        }));
        if (userId) get().updateProviderById(a.provider_id, { user_id: userId });
        return { ok: true };
      },

      updateAffiliation: (affiliationId, data) => {
        const now = new Date().toISOString();
        set((s) => ({
          affiliations: s.affiliations.map((x) =>
            x.id === affiliationId ? { ...x, ...data, updated_at: now } : x
          ),
        }));
      },

      addResourceSchedule: (unitId, data) => {
        const unit = get().providers.find((p) => p.id === unitId);
        if (!unit) return { ok: false, error: "היחידה לא נמצאה" };
        if (!data.name.trim()) return { ok: false, error: 'יש להזין שם ללו״ז' };
        const schedule: ResourceSchedule = {
          id: generateId("sched"),
          name: data.name.trim(),
          schedule: data.schedule,
          schedule_exceptions: data.schedule_exceptions,
          created_at: new Date().toISOString(),
        };
        get().updateProviderById(unitId, {
          resource_schedules: [...(unit.resource_schedules ?? []), schedule],
        });
        return { ok: true, scheduleId: schedule.id };
      },
      updateResourceSchedule: (unitId, scheduleId, data) => {
        const unit = get().providers.find((p) => p.id === unitId);
        if (!unit) return;
        get().updateProviderById(unitId, {
          resource_schedules: (unit.resource_schedules ?? []).map((s) =>
            s.id === scheduleId
              ? { ...s, ...data, name: data.name?.trim() ?? s.name }
              : s
          ),
        });
      },
      deleteResourceSchedule: (unitId, scheduleId) => {
        const unit = get().providers.find((p) => p.id === unitId);
        if (!unit) return;
        // Detach every resource that referenced this לו״ז so it doesn't dangle
        // (they revert to their own inline schedule, i.e. no shared hours).
        const detach = <T extends { schedule_id?: string }>(r: T): T =>
          r.schedule_id === scheduleId ? { ...r, schedule_id: undefined } : r;
        get().updateProviderById(unitId, {
          resource_schedules: (unit.resource_schedules ?? []).filter((s) => s.id !== scheduleId),
          facilities: (unit.facilities ?? []).map(detach),
          affiliated_doctors: (unit.affiliated_doctors ?? []).map(detach),
        });
      },
      applyResourceSchedule: (unitId, scheduleId, targets) => {
        const unit = get().providers.find((p) => p.id === unitId);
        if (!unit) return;
        const facilityIds = new Set(targets.facilityIds ?? []);
        const doctorIds = new Set(targets.doctorAffiliationIds ?? []);
        const nextId = scheduleId ?? undefined;
        get().updateProviderById(unitId, {
          facilities: (unit.facilities ?? []).map((f) =>
            facilityIds.has(f.id) ? { ...f, schedule_id: nextId } : f
          ),
          affiliated_doctors: (unit.affiliated_doctors ?? []).map((a) =>
            doctorIds.has(a.id) ? { ...a, schedule_id: nextId } : a
          ),
        });
      },

      setProviderCommission: (id, rate) => get().updateProviderById(id, { commission_rate: rate }),
      setDefaultCommissionRate: (rate) => set({ defaultCommissionRate: rate }),
      setServiceTypeCommissionRate: (type, rate) =>
        set((s) => {
          const next = { ...s.commissionRateByServiceType };
          if (rate === undefined) delete next[type];
          else next[type] = rate;
          return { commissionRateByServiceType: next };
        }),

      upsertProviderProfile: (userId, data) => {
        const existing = userId ? get().providers.find((p) => p.user_id === userId) : undefined;
        if (existing) {
          get().updateProviderById(existing.id, data);
          return get().providers.find((p) => p.id === existing.id)!;
        }
        const record: ProviderProfile = {
          id: generateId("prov"),
          user_id: userId,
          display_name: data.display_name ?? "",
          specialty: data.specialty ?? "",
          is_published: false,
          status: "pending_review",
          agreements: [],
          consultation_types: [],
          exam_types: [],
          clinic_locations: [],
          referral_forms: [],
          created_date: new Date().toISOString(),
          ...data,
        };
        if (record.status !== "approved") {
          record.is_published = false;
        }
        set((s) => ({ providers: [...s.providers, record] }));
        return record;
      },

      createOrganization: (data) => {
        const record: ProviderProfile = {
          id: generateId("prov"),
          display_name: data.display_name,
          contact_name: data.contact_name,
          contact_phone: data.contact_phone,
          contact_email: data.contact_email,
          member_provider_types: data.member_provider_types,
          is_organization: true,
          specialty: "ארגון בריאות",
          // Ops-created organizations don't go through the public application
          // pipeline — they're trusted from day one, but the org record itself
          // is never published (its units are what patients see).
          status: "approved",
          is_published: false,
          license_verified_at: new Date().toISOString(),
          agreements: [],
          consultation_types: [],
          exam_types: [],
          clinic_locations: [],
          referral_forms: [],
          created_date: new Date().toISOString(),
        };
        set((s) => ({ providers: [record, ...s.providers] }));
        return record;
      },

      addOrganizationBranch: (unitId, data) => {
        const unit = get().providers.find((p) => p.id === unitId);
        if (!unit) return { ok: false, error: "היחידה לא נמצאה" };
        if (!data.name.trim()) return { ok: false, error: "יש להזין שם סניף" };
        const branch: OrganizationBranch = {
          id: generateId("branch"),
          unit_id: unitId,
          name: data.name.trim(),
          city: data.city?.trim() || undefined,
          address: data.address?.trim() || undefined,
          contact_phone: data.contact_phone?.trim() || undefined,
          contact_email: data.contact_email?.trim() || undefined,
          created_date: new Date().toISOString(),
        };
        set((s) => ({ organizationBranches: [branch, ...s.organizationBranches] }));
        return { ok: true, branch };
      },
      updateOrganizationBranch: (id, data) =>
        set((s) => ({
          organizationBranches: s.organizationBranches.map((b) => (b.id === id ? { ...b, ...data } : b)),
        })),
      deleteOrganizationBranch: (id) => {
        const branch = get().organizationBranches.find((b) => b.id === id);
        // Removing a branch removes its מערכים too, and detaches any resource of
        // the branch's unit that pointed at one of them (they revert to "ללא מערך").
        const removedArrayIds = new Set(
          get().serviceArrays.filter((a) => a.branch_id === id).map((a) => a.id)
        );
        set((s) => ({
          organizationBranches: s.organizationBranches.filter((b) => b.id !== id),
          serviceArrays: s.serviceArrays.filter((a) => a.branch_id !== id),
        }));
        if (branch && removedArrayIds.size > 0) {
          get().detachServiceArrays(branch.unit_id, removedArrayIds);
        }
        return { ok: true };
      },

      addServiceArray: (branchId, data) => {
        const branch = get().organizationBranches.find((b) => b.id === branchId);
        if (!branch) return { ok: false, error: "הסניף לא נמצא" };
        const serviceArray: ServiceArray = {
          id: generateId("sarr"),
          branch_id: branchId,
          type: data.type,
          name: data.name?.trim() || SERVICE_ARRAY_TYPE_LABELS[data.type],
          created_date: new Date().toISOString(),
        };
        set((s) => ({ serviceArrays: [...s.serviceArrays, serviceArray] }));
        return { ok: true, serviceArray };
      },
      updateServiceArray: (id, data) =>
        set((s) => ({
          serviceArrays: s.serviceArrays.map((a) =>
            a.id === id ? { ...a, ...data, name: data.name?.trim() || a.name } : a
          ),
        })),
      deleteServiceArray: (id) => {
        const arr = get().serviceArrays.find((a) => a.id === id);
        set((s) => ({ serviceArrays: s.serviceArrays.filter((a) => a.id !== id) }));
        if (arr) {
          const unit = get().organizationBranches.find((b) => b.id === arr.branch_id);
          if (unit) get().detachServiceArrays(unit.unit_id, new Set([id]));
        }
        return { ok: true };
      },
      // Clear service_array_id off a unit's resources when their מערך is gone.
      detachServiceArrays: (unitId: string, arrayIds: Set<string>) => {
        const unit = get().providers.find((p) => p.id === unitId);
        if (!unit) return;
        const detach = <T extends { service_array_id?: string }>(r: T): T =>
          r.service_array_id && arrayIds.has(r.service_array_id)
            ? { ...r, service_array_id: undefined }
            : r;
        get().updateProviderById(unitId, {
          facilities: (unit.facilities ?? []).map(detach),
          affiliated_doctors: (unit.affiliated_doctors ?? []).map(detach),
        });
      },

      addOrganizationUnit: (organizationId, data) => {
        const org = get().providers.find((p) => p.id === organizationId);
        if (!org) return { ok: false, error: "הארגון לא נמצא" };
        if (!data.display_name.trim()) return { ok: false, error: "יש להזין שם יחידה" };
        const unit: ProviderProfile = {
          id: generateId("prov"),
          parent_organization_id: organizationId,
          provider_type: data.provider_type,
          display_name: data.display_name.trim(),
          specialty: data.specialty ?? "",
          license_number: data.license_number,
          contact_phone: data.contact_phone,
          contact_email: data.contact_email,
          is_published: false,
          // Admin-created units skip the public license-review queue — Ops is
          // the one creating them — and land straight in onboarding so the
          // unit's user can complete agreements/catalog/availability.
          // This IS the unit path: no רישום phase, straight into הקמה with a
          // blank slate (see src/lib/provider-phases.ts).
          onboarding_path: "unit",
          status: "onboarding",
          license_verified_at: new Date().toISOString(),
          application_submitted_at: new Date().toISOString(),
          agreements: [],
          consultation_types: [],
          exam_types: [],
          clinic_locations: [],
          referral_forms: [],
          created_date: new Date().toISOString(),
        };
        set((s) => ({ providers: [unit, ...s.providers] }));
        if (data.provider_type && !org.member_provider_types?.includes(data.provider_type)) {
          get().updateProviderById(organizationId, {
            member_provider_types: [...(org.member_provider_types ?? []), data.provider_type],
          });
        }
        return { ok: true, unitId: unit.id };
      },

      createProviderUnitUser: (providerId, data) => {
        const provider = get().providers.find((p) => p.id === providerId);
        if (!provider) return { ok: false, error: "היחידה לא נמצאה" };
        if (provider.user_id) return { ok: false, error: "ליחידה כבר משויך משתמש כניסה" };
        const email = data.email.trim().toLowerCase();
        if (!email || !data.full_name.trim()) {
          return { ok: false, error: "יש להזין שם מלא ואימייל" };
        }
        if (get().users.some((u) => u.email.toLowerCase() === email)) {
          return { ok: false, error: "כבר קיים משתמש עם כתובת האימייל הזו" };
        }
        const user: User = {
          id: generateId("user"),
          email,
          full_name: data.full_name.trim(),
          phone: data.phone,
          role: "provider",
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, user] }));
        get().updateProviderById(providerId, {
          user_id: user.id,
          contact_email: provider.contact_email ?? email,
        });
        // Mock temp credential (no real auth backend) — shown once to the admin.
        const tempPassword = `Hls!${Math.random().toString(36).slice(2, 10)}`;
        return { ok: true, user, tempPassword };
      },

      addAppointment: (a) => {
        // §PRV-10 — stamp the single event owner and the delivering person so
        // the cross-context double-booking guard has data to key on, unless the
        // caller already resolved them explicitly.
        let practitioner_id = a.practitioner_id;
        let owner_context_id = a.owner_context_id;
        if (a.resource_id) {
          // Unit booking against a specific resource (facility or a person).
          owner_context_id = owner_context_id ?? a.resource_id;
          if (practitioner_id === undefined) {
            const aff = get().affiliations.find((x) => x.id === a.resource_id);
            if (aff) practitioner_id = aff.provider_id; // a facility resource has no person
          }
        } else if (a.provider_id) {
          owner_context_id = owner_context_id ?? a.provider_id;
          if (practitioner_id === undefined) {
            const prov = get().providers.find((p) => p.id === a.provider_id);
            if (prov && isPractitionerProviderType(prov.provider_type)) practitioner_id = prov.id;
          }
        }
        const record: Appointment = { ...a, id: generateId("appt"), practitioner_id, owner_context_id };
        set((s) => ({ appointments: [record, ...s.appointments] }));
        return record;
      },
      updateAppointment: (id, data) =>
        set((s) => ({
          appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...data } : a)),
        })),
      updateReminderSettings: (data) =>
        set((s) => ({ reminderSettings: { ...s.reminderSettings, ...data } })),

      addOrder: (o) => {
        const record: Order = { ...o, id: generateId("ord"), created_date: new Date().toISOString() };
        set((s) => ({ orders: [record, ...s.orders] }));
        return record;
      },
      updateOrder: (id, data) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...data } : o)) })),

      addLabReferral: (r) => {
        const record: LabReferral = { ...r, id: generateId("lab"), created_date: new Date().toISOString() };
        set((s) => ({ labReferrals: [record, ...s.labReferrals] }));
        return record;
      },
      updateLabReferral: (id, data) =>
        set((s) => ({
          labReferrals: s.labReferrals.map((r) => (r.id === id ? { ...r, ...data } : r)),
        })),

      addVisitRecord: (v) => {
        const record: VisitRecord = { ...v, id: generateId("visit"), created_date: new Date().toISOString() };
        set((s) => ({ visitRecords: [record, ...s.visitRecords] }));
        return record;
      },
      updateVisitRecord: (id, data) =>
        set((s) => ({
          visitRecords: s.visitRecords.map((v) => (v.id === id ? { ...v, ...data } : v)),
        })),
      addDocument: (d) => {
        const record: PatientDocument = { ...d, id: generateId("doc"), created_date: new Date().toISOString() };
        set((s) => ({ documents: [record, ...s.documents] }));
        return record;
      },
      updateDocument: (id, data) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === id ? { ...d, ...data } : d)),
        })),
      deleteDocument: (id) => set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      addWaitlistEntry: (w) => {
        const record: WaitlistEntry = { ...w, id: generateId("wait"), status: "ממתין", created_date: new Date().toISOString() };
        set((s) => ({ waitlist: [record, ...s.waitlist] }));
        return record;
      },

      addCatalogItem: (c) => {
        const record: CatalogItem = { ...c, id: generateId("cat") };
        set((s) => ({ catalog: [record, ...s.catalog] }));
        return record;
      },
      updateCatalogItem: (id, data) =>
        set((s) => ({ catalog: s.catalog.map((c) => (c.id === id ? { ...c, ...data } : c)) })),
      deleteCatalogItem: (id) => set((s) => ({ catalog: s.catalog.filter((c) => c.id !== id) })),
      bulkAddCatalogItems: (items) => {
        const records = items.map((c) => ({ ...c, id: generateId("cat") }));
        set((s) => ({ catalog: [...records, ...s.catalog] }));
        return records.length;
      },
      importMohPriceList: (rows) => {
        let added = 0;
        let updated = 0;
        set((s) => {
          const catalog = [...s.catalog];
          const byCode = new Map(
            catalog.filter((c) => c.catalog === "mabar" && c.tavar_code).map((c) => [c.tavar_code!, c])
          );
          for (const row of rows) {
            const existing = byCode.get(row.tavar_code);
            const layer_prices = [
              { layer: "S" as const, price: row.price_s },
              { layer: "H" as const, price: row.price_h },
            ];
            if (existing) {
              updated++;
              const idx = catalog.findIndex((c) => c.id === existing.id);
              catalog[idx] = {
                ...existing,
                name_he: row.name_he,
                base_price: row.price_s,
                layer_prices,
                typical_duration_min: row.typical_duration_min ?? existing.typical_duration_min,
                requires_referral: row.requires_referral,
                is_active: true,
              };
            } else {
              added++;
              const record: CatalogItem = {
                id: generateId("cat"),
                tavar_code: row.tavar_code,
                name_he: row.name_he,
                catalog: "mabar",
                skill_domain_id: row.skill_domain_id,
                skill_subdomain_id: row.skill_subdomain_id,
                service_type: row.service_type,
                base_price: row.price_s,
                layer_prices,
                typical_duration_min: row.typical_duration_min,
                requires_referral: row.requires_referral,
                is_active: true,
              };
              catalog.unshift(record);
              byCode.set(row.tavar_code, record);
            }
          }
          return { catalog };
        });
        return { added, updated };
      },
      bulkDeleteCatalogItems: (ids) => {
        const idSet = new Set(ids);
        set((s) => ({ catalog: s.catalog.filter((c) => !idSet.has(c.id)) }));
      },
      bulkSetCatalogItemsActive: (ids, is_active) => {
        const idSet = new Set(ids);
        set((s) => ({ catalog: s.catalog.map((c) => (idSet.has(c.id) ? { ...c, is_active } : c)) }));
      },

      // ---- Catalog requests ----
      addCatalogRequest: (input) => {
        const record: CatalogRequest = {
          ...input,
          id: generateId("creq"),
          status: "pending",
          created_date: new Date().toISOString(),
        };
        set((s) => ({ catalogRequests: [record, ...s.catalogRequests] }));
        return record;
      },
      approveCatalogRequestAsItem: (id, values) => {
        const item = get().addCatalogItem(values);
        set((s) => ({
          catalogRequests: s.catalogRequests.map((r) =>
            r.id === id
              ? { ...r, status: "approved", resolved_item_id: item.id, resolved_at: new Date().toISOString() }
              : r
          ),
        }));
        return item;
      },
      mergeCatalogRequest: (id, existingItemId) =>
        set((s) => ({
          catalogRequests: s.catalogRequests.map((r) =>
            r.id === id
              ? { ...r, status: "merged", resolved_item_id: existingItemId, resolved_at: new Date().toISOString() }
              : r
          ),
        })),
      rejectCatalogRequest: (id, note) =>
        set((s) => ({
          catalogRequests: s.catalogRequests.map((r) =>
            r.id === id ? { ...r, status: "rejected", admin_note: note, resolved_at: new Date().toISOString() } : r
          ),
        })),
      requestCatalogRequestInfo: (id, note) =>
        set((s) => ({
          catalogRequests: s.catalogRequests.map((r) =>
            r.id === id ? { ...r, status: "needs_info", admin_note: note } : r
          ),
        })),

      bulkAddProviders: (items) => {
        const records = items.map((p) => ({
          ...p,
          id: generateId("prov"),
          created_date: new Date().toISOString(),
        }));
        set((s) => ({ providers: [...records, ...s.providers] }));
        return records.length;
      },

      addSkillDomain: (d) => {
        const record: SkillDomain = { ...d, id: generateId("dom") };
        set((s) => ({ skillDomains: [...s.skillDomains, record] }));
        return record;
      },
      updateSkillDomain: (id, data) =>
        set((s) => ({ skillDomains: s.skillDomains.map((d) => (d.id === id ? { ...d, ...data } : d)) })),
      deleteSkillDomain: (id) =>
        set((s) => ({
          skillDomains: s.skillDomains.filter((d) => d.id !== id),
          skillSubdomains: s.skillSubdomains.filter((sd) => sd.domain_id !== id),
          catalog: s.catalog.filter((c) => c.skill_domain_id !== id),
        })),
      addSkillSubdomain: (sd) => {
        const record: SkillSubdomain = { ...sd, id: generateId("sub") };
        set((s) => ({ skillSubdomains: [...s.skillSubdomains, record] }));
        return record;
      },
      updateSkillSubdomain: (id, data) =>
        set((s) => ({ skillSubdomains: s.skillSubdomains.map((sd) => (sd.id === id ? { ...sd, ...data } : sd)) })),
      deleteSkillSubdomain: (id) =>
        set((s) => ({
          skillSubdomains: s.skillSubdomains.filter((sd) => sd.id !== id),
          catalog: s.catalog.filter((c) => c.skill_subdomain_id !== id),
        })),

      grantConsent: (patientId, type, version = CONSENT_DOCUMENT_VERSION) => {
        const record: ConsentRecord = {
          id: generateId("consent"),
          patient_id: patientId,
          consent_type: type,
          version,
          granted: true,
          granted_at: new Date().toISOString(),
        };
        set((s) => ({ consentRecords: [record, ...s.consentRecords] }));
        return record;
      },
      revokeConsent: (recordId) =>
        set((s) => ({
          consentRecords: s.consentRecords.map((c) =>
            c.id === recordId ? { ...c, revoked_at: new Date().toISOString() } : c
          ),
        })),
      getPatientConsents: (patientId) => get().consentRecords.filter((c) => c.patient_id === patientId),

      addDsrRequest: (r) => {
        const record: DsrRequest = {
          ...r,
          id: generateId("dsr"),
          status: r.status ?? "ממתין",
          requested_at: new Date().toISOString(),
        };
        set((s) => ({ dsrRequests: [record, ...s.dsrRequests] }));
        return record;
      },
      updateDsrRequest: (id, data) =>
        set((s) => ({ dsrRequests: s.dsrRequests.map((r) => (r.id === id ? { ...r, ...data } : r)) })),

      reportOtpIssue: (channel, contact, context) => {
        const record: OtpIssueReport = {
          id: generateId("otpissue"),
          channel,
          contact,
          context,
          status: "פתוח",
          reported_at: new Date().toISOString(),
        };
        set((s) => ({ otpIssueReports: [record, ...s.otpIssueReports] }));
        return record;
      },
      updateOtpIssueReport: (id, data) =>
        set((s) => ({
          otpIssueReports: s.otpIssueReports.map((r) => (r.id === id ? { ...r, ...data } : r)),
        })),

      exportPatientData: (patientId) => {
        const patient = get().patients.find((p) => p.id === patientId);
        if (!patient) return null;
        return {
          patient,
          appointments: get().appointments.filter((a) => a.created_by_id === patientId),
          orders: get().orders.filter((o) => o.created_by_id === patientId),
          consents: get().getPatientConsents(patientId),
          exported_at: new Date().toISOString(),
        };
      },
    }),
    {
      name: "healson-platform-store",
      version: 36,
      // The v1 -> v2 schema change (SKBH pricing, skill taxonomy, consent
      // records), the v2 -> v3 addition of the DEMO_NEW_PATIENT_USER seed
      // account, the v3 -> v4 AppointmentStatus rename ("ממתין לאישור" ->
      // "ממתין לתשלום מקדמה", "הושלם" -> "בוצע"), the v4 -> v5 admin-dashboard
      // additions (User.admin_title, Patient.processing_restricted,
      // commissionRateByServiceType, second seeded superadmin), the v5 -> v6
      // addition of the "שולם במלואו" AppointmentStatus and "extra"-service_type
      // catalog items (used by the new "שירותים נוספים" search tab), the
      // v6 -> v7 correction of K_LEVELS_BY_KUPAH plan names (stray whitespace
      // trimmed, so persisted kupah_arrangements referencing the old literal
      // strings would silently stop matching) are not backwards compatible
      // with anything persisted under an earlier version. From v7, two
      // branches of work bumped this independently and reused the same
      // v8/v9/v10 numbers for unrelated schema changes — provider
      // calendars-linked-to-services onboarding gating, visitRecords, demo
      // credential issuance, the consultations/exams catalog merge, the
      // provider-signup rework (immediate account+session instead of
      // waiting on Ops), and the skill-tree/global-catalog expansion on one
      // side; two published demo providers, Appointment.price/deposit
      // fields, and the documents tab on the other. v12 reconciles both
      // into one combined schema. v12 -> v13 backfills service_type and
      // linked_clinic_ids onto provider5/provider6's consultation_types —
      // without those, ProviderDiscovery's per-tab/specialty filtering
      // (which now reads services straight off each provider instead of a
      // shared reference catalog) could never surface those two doctors.
      // v13 -> v14 spreads SEED_APPOINTMENTS across all 4 published demo
      // providers instead of just provider1/provider2 — without any booked
      // appointments, a provider's calendar can never show a fully-booked
      // day or a waitlist-eligible slot, so the other two doctors could
      // never demo that flow. v14 -> v15 adds Appointment.clinic_id and a
      // second clinic_location for provider1 (multi-location booking demo,
      // each location with its own weekly hours) — discard any state
      // persisted under an earlier version so the app reseeds clean instead
      // of silently keeping stale seed/demo/status/catalog data.
      // v15 -> v16 adds the "other" DocumentCategory and
      // ConsultationType.required_documents (pre-appointment document
      // checklist), plus new hand-seeded demo PatientDocument rows for it —
      // without the bump, existing persisted state keeps the old document set.
      // v16 -> v17 is the provider-management upgrade: the "other_medical"
      // ProviderType was removed, Clinic gained the shift-based
      // schedule/schedule_exceptions model (replacing single-range `hours`),
      // ProviderProfile gained affiliated_doctors, and two organization demo
      // accounts (מכון רפואי / מרפאת חוץ) plus their doctors were seeded.
      // Persisted state from v16 has none of that, so reseed clean.
      // v17 -> v18 splits the reference catalog into two separate catalogs
      // (קטלוג מב"ר / קטלוג הילסון): CatalogItem gained catalog / price_full /
      // layer_prices, and seed codes changed (MoH codes vs HLS-…). Items
      // persisted under v17 have no catalog assignment, so reseed clean.
      // v18 -> v19 adds catalogRequests (providers requesting a missing Healson
      // catalog item, triaged by Ops) with its seed rows — reseed clean so the
      // new state slice and demo requests are present.
      // v19 -> v20 adds the org→branch→unit hierarchy: a new organizationBranches
      // slice, ProviderProfile.parent_branch_id on units, and a seeded demo
      // organization with two branches — reseed clean so branches are present.
      // v20 -> v21 REVERSES the hierarchy to ארגון → יחידה → סניף: a branch now
      // belongs to a unit (OrganizationBranch.unit_id), parent_branch_id was
      // dropped from units, and the demo org reseeds as units-with-branches.
      // v21 -> v22 adds מערך (service_array) + capacity to unit לוזים
      // (ProviderFacility/AffiliatedDoctor) and tags the demo units' resources —
      // reseed clean so the מערך grouping + capacity show on the demo accounts.
      // v22 -> v23 tags the demo institute's affiliated doctors with a מערך
      // (service_array) so the merged מערכים→לוזים availability view groups them.
      // v23 -> v24 adds shared resource schedules (ResourceSchedule): a unit-level
      // resource_schedules array + schedule_id on ProviderFacility/AffiliatedDoctor,
      // so one לו״ז can be applied to several resources at once — reseed clean.
      // v24 -> v25 makes מערך first-class: a new serviceArrays slice (ServiceArray,
      // typed from SERVICE_ARRAY_TYPES, keyed to a branch), service_array_id on
      // resources replacing the free-text service_array, and seeded מערכים for the
      // demo מכון's branches — reseed clean so the new slice + links are present.
      // v25 -> v26 back-fills the FULL hierarchy across every unit: the standalone
      // units (מכון הדסה / מרפאות חוץ) now get a branch + מערכים generated from their
      // resources, and the demo מרפאת חוץ branch gets its מערכים — reseed so every
      // unit shows סניף → מערך → משאב, not just the demo org's מכון.
      // v26 -> v27 splits the provider join flow into two named phases and two
      // paths (ProviderProfile.onboarding_path — see src/lib/provider-phases.ts),
      // renames the unit resource concept to עמדה, and assigns the demo מכון its
      // own patients — reseed clean so the demo accounts reflect all three.
      // v27 -> v28 promotes the provider⇄unit link to a first-class, bidirectionally-
      // consented `affiliations` slice (ProviderAffiliation, §PRV-10), moves the
      // in-unit schedule onto it, and adds Appointment.practitioner_id/
      // owner_context_id so a human is never double-booked across contexts.
      // v28 -> v29 migrates the demo units' embedded doctors into the affiliations
      // slice (single source of truth) and seeds a provider-side demo.
      // v29 -> v30 stamps provider_type "doctor" on the legacy solo demo doctors
      // (prov_1/prov_2) so they read as practitioners — reseed clean.
      // v30 -> v31 attributes every seeded UNIT appointment to the עמדה that
      // serves it (Appointment.resource_id/owner_context_id/practitioner_id), so
      // the provider portal's new day board — a column per עמדה — opens with
      // real patients in the right columns instead of one unattributed pile.
      // v31 -> v32 does the same for SOLO providers: each seeded appointment
      // carries the clinic_id it was booked at, so their day board can separate
      // "my clinic" from "shifts a unit scheduled me for" — reseed clean.
      // v32 -> v33 is the provider demo-data correctness pass: catalogues that
      // match each provider's specialty (an orthopaedist no longer "operates" an
      // MRI, a מכון no longer sells consultations), MoH codes on every coded
      // item, canonical insurer names so layer-B pricing actually matches, real
      // shift-based weeks with per-shift slot lengths, and appointment/order
      // prices resolved from the provider's own price list — reseed clean.
      // v33 -> v34 is the search branch, renumbered on merge because both
      // branches independently reused v31/v32: the SKBHP price migration
      // (price_full base price on every item, H repurposed as a dedicated
      // tourist price, S entries zeroed since basket coverage has no payable
      // amount) plus dropping the placeholder "ביטוח ישיר" policy from the demo
      // patient — reseed clean.
      // v34 -> v35 restores the demo patient's canonical insurer name
      // ("מגדל ביטוח", not "מגדל" — the short form never matches an agreement)
      // and adds it to ד"ר לוי's layer-B agreement, so his knee arthroscopy
      // demonstrates route B settled by an insurer undertaking — reseed clean.
      // v35 -> v36 scopes ד"ר לוי's שב"ן agreement to the Ramat Gan clinic, so the
      // per-clinic agreement model is visible in the demo — reseed clean.
      migrate: (persistedState, version) => (version < 36 ? ({} as Store) : (persistedState as Store)),
      // Uploaded files (photos/PDFs) are stored as base64 data URLs inside
      // this same persisted blob (no real backend — see file.ts). If a
      // single write ever still exceeds the browser's localStorage quota
      // (e.g. many uploads accumulated over a long demo session), swallow
      // it here instead of letting it throw an unhandled rejection that
      // breaks every subsequent store write app-wide — the in-memory state
      // (and thus the current session) stays fully usable either way, it
      // just won't survive a refresh.
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch (err) {
            console.warn(
              "[healson] localStorage quota exceeded — this change won't persist across page reloads.",
              err
            );
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
