import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Appointment,
  CatalogItem,
  ConsentRecord,
  ConsentType,
  CONSENT_DOCUMENT_VERSION,
  DsrRequest,
  DsrRequestStatus,
  Kupah,
  KLevel,
  Lead,
  LabReferral,
  Order,
  Patient,
  ProviderProfile,
  Role,
  SkillDomain,
  SkillSubdomain,
  ToastItem,
  User,
} from "@/types";
import {
  SEED_APPOINTMENTS,
  SEED_BRANCHES,
  SEED_CATALOG,
  SEED_CONSENT_RECORDS,
  SEED_DSR_REQUESTS,
  SEED_LAB_REFERRALS,
  SEED_LEADS,
  SEED_ORDERS,
  SEED_PATIENTS,
  SEED_PROVIDERS,
  SEED_USERS,
} from "./mock-data";
import { SEED_SKILL_DOMAINS, SEED_SKILL_SUBDOMAINS } from "./medical-tree";
import { generateId } from "./utils";

// ---------------------------------------------------------------------------
// Auth slice
// ---------------------------------------------------------------------------
interface PendingRegistration {
  email: string;
  password: string;
  otp: string;
}

export interface InsuranceProfileInput {
  kupah: Kupah;
  k_level?: KLevel;
  has_b_insurance?: boolean;
  b_insurance_company?: string;
  b_policy_number?: string;
  address?: string;
}

export type RegistrationConsents = Partial<Record<ConsentType, boolean>>;

interface AuthState {
  currentUser: User | null;
  pendingRegistration: PendingRegistration | null;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  loginWithGoogle: () => void;
  register: (email: string, password: string) => { ok: boolean; otpHint: string };
  verifyOtp: (email: string, code: string) => { ok: boolean; error?: string };
  resendOtp: () => string | null;
  forgotPassword: (email: string) => { ok: boolean };
  resetPassword: (newPassword: string) => { ok: boolean };
  logout: () => void;
  loginAsDemo: (role: Role) => void;
  completePatientRegistration: (
    userId: string,
    data: { full_name: string; phone?: string; id_number: string; date_of_birth: string } & InsuranceProfileInput,
    consents: RegistrationConsents
  ) => Patient;
  quickRegisterPatient: (
    data: { full_name: string; phone: string; email: string } & Partial<InsuranceProfileInput>,
    consents?: RegistrationConsents
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
  catalog: CatalogItem[];
  skillDomains: SkillDomain[];
  skillSubdomains: SkillSubdomain[];
  appointments: Appointment[];
  orders: Order[];
  labReferrals: LabReferral[];
  branches: typeof SEED_BRANCHES;
  consentRecords: ConsentRecord[];
  dsrRequests: DsrRequest[];
  defaultCommissionRate: number;

  addPatient: (p: Omit<Patient, "id" | "created_date">) => Patient;
  updatePatient: (id: string, data: Partial<Patient>) => void;
  deletePatient: (id: string) => void;

  addLead: (l: Omit<Lead, "id" | "created_date">) => Lead;
  updateLead: (id: string, data: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  convertLead: (id: string) => void;

  upsertProviderProfile: (
    userId: string | undefined,
    data: Partial<ProviderProfile>
  ) => ProviderProfile;
  updateProviderById: (id: string, data: Partial<ProviderProfile>) => void;
  approveProvider: (id: string) => void;
  rejectProvider: (id: string, reason: string) => void;
  setProviderCommission: (id: string, rate: number) => void;
  setDefaultCommissionRate: (rate: number) => void;

  addAppointment: (a: Omit<Appointment, "id">) => Appointment;
  updateAppointment: (id: string, data: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;

  addOrder: (o: Omit<Order, "id" | "created_date">) => Order;
  updateOrder: (id: string, data: Partial<Order>) => void;

  addLabReferral: (r: Omit<LabReferral, "id" | "created_date">) => LabReferral;
  updateLabReferral: (id: string, data: Partial<LabReferral>) => void;

  addCatalogItem: (c: Omit<CatalogItem, "id">) => CatalogItem;
  updateCatalogItem: (id: string, data: Partial<CatalogItem>) => void;
  deleteCatalogItem: (id: string) => void;
  bulkAddCatalogItems: (items: Omit<CatalogItem, "id">[]) => number;
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

      login: (email, password) => {
        if (!email || !password) return { ok: false, error: "נא להזין אימייל וסיסמה" };
        const existing = get().users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (existing) {
          set({ currentUser: existing });
          return { ok: true };
        }
        // Unknown email -> mock-create a new patient account on the fly.
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

      loginWithGoogle: () => {
        get().loginAsDemo("patient");
      },

      loginAsDemo: (role) => {
        const user = get().users.find((u) => u.role === role) ?? null;
        set({ currentUser: user });
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

      forgotPassword: () => ({ ok: true }),
      resetPassword: () => ({ ok: true }),

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
          date_of_birth: data.date_of_birth,
          address: data.address,
          kupah: data.kupah,
          k_level: data.k_level,
          has_b_insurance: data.has_b_insurance,
          b_insurance_company: data.b_insurance_company,
          b_policy_number: data.b_policy_number,
          status: "פעיל",
          user_id: userId,
        });
        (Object.keys(consents) as ConsentType[]).forEach((type) => {
          if (consents[type]) get().grantConsent(patient.id, type, CONSENT_DOCUMENT_VERSION);
        });
        return patient;
      },

      quickRegisterPatient: (data, consents) => {
        const existingPatient = get().patients.find(
          (p) => p.email && p.email.toLowerCase() === data.email.toLowerCase()
        );
        if (existingPatient) {
          const existingUser = get().users.find((u) => u.id === existingPatient.user_id);
          if (existingUser) set({ currentUser: existingUser });
          if (data.kupah) {
            get().updatePatient(existingPatient.id, {
              kupah: data.kupah,
              k_level: data.k_level,
              has_b_insurance: data.has_b_insurance,
              b_insurance_company: data.b_insurance_company,
              b_policy_number: data.b_policy_number,
              address: data.address,
            });
          }
          if (consents) {
            (Object.keys(consents) as ConsentType[]).forEach((type) => {
              if (consents[type]) get().grantConsent(existingPatient.id, type, CONSENT_DOCUMENT_VERSION);
            });
          }
          return existingPatient;
        }
        const newUser: User = {
          id: generateId("user"),
          email: data.email,
          full_name: data.full_name,
          role: "patient",
          phone: data.phone,
          created_date: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, newUser], currentUser: newUser }));
        const patient = get().addPatient({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          kupah: data.kupah ?? "כללית",
          k_level: data.k_level,
          has_b_insurance: data.has_b_insurance,
          b_insurance_company: data.b_insurance_company,
          b_policy_number: data.b_policy_number,
          address: data.address,
          status: "פעיל",
          user_id: newUser.id,
        });
        if (consents) {
          (Object.keys(consents) as ConsentType[]).forEach((type) => {
            if (consents[type]) get().grantConsent(patient.id, type, CONSENT_DOCUMENT_VERSION);
          });
        }
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
      catalog: SEED_CATALOG,
      skillDomains: SEED_SKILL_DOMAINS,
      skillSubdomains: SEED_SKILL_SUBDOMAINS,
      appointments: SEED_APPOINTMENTS,
      orders: SEED_ORDERS,
      labReferrals: SEED_LAB_REFERRALS,
      branches: SEED_BRANCHES,
      consentRecords: SEED_CONSENT_RECORDS,
      dsrRequests: SEED_DSR_REQUESTS,
      defaultCommissionRate: 15,

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
        if (!lead) return;
        get().addPatient({
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          kupah: "כללית",
          status: "פעיל",
        });
        get().updateLead(id, { status: "הומר", conversion_date: new Date().toISOString() });
      },

      updateProviderById: (id, data) =>
        set((s) => ({ providers: s.providers.map((p) => (p.id === id ? { ...p, ...data } : p)) })),

      approveProvider: (id) => {
        get().updateProviderById(id, { verification_status: "מאושר", rejection_reason: undefined });
      },
      rejectProvider: (id, reason) => {
        get().updateProviderById(id, { verification_status: "נדחה", rejection_reason: reason, is_published: false });
      },
      setProviderCommission: (id, rate) => get().updateProviderById(id, { commission_rate: rate }),
      setDefaultCommissionRate: (rate) => set({ defaultCommissionRate: rate }),

      upsertProviderProfile: (userId, data) => {
        const existing = userId ? get().providers.find((p) => p.user_id === userId) : undefined;
        if (existing) {
          const updated = { ...existing, ...data };
          set((s) => ({ providers: s.providers.map((p) => (p.id === existing.id ? updated : p)) }));
          return updated;
        }
        const record: ProviderProfile = {
          id: generateId("prov"),
          user_id: userId,
          display_name: data.display_name ?? "",
          specialty: data.specialty ?? "",
          is_published: false,
          is_active: true,
          verification_status: "ממתין",
          agreements: [],
          consultation_types: [],
          exam_types: [],
          clinic_locations: [],
          referral_forms: [],
          created_date: new Date().toISOString(),
          ...data,
        };
        set((s) => ({ providers: [...s.providers, record] }));
        return record;
      },

      addAppointment: (a) => {
        const record: Appointment = { ...a, id: generateId("appt") };
        set((s) => ({ appointments: [record, ...s.appointments] }));
        return record;
      },
      updateAppointment: (id, data) =>
        set((s) => ({
          appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...data } : a)),
        })),
      deleteAppointment: (id) =>
        set((s) => ({ appointments: s.appointments.filter((a) => a.id !== id) })),

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
        })),
      addSkillSubdomain: (sd) => {
        const record: SkillSubdomain = { ...sd, id: generateId("sub") };
        set((s) => ({ skillSubdomains: [...s.skillSubdomains, record] }));
        return record;
      },
      updateSkillSubdomain: (id, data) =>
        set((s) => ({ skillSubdomains: s.skillSubdomains.map((sd) => (sd.id === id ? { ...sd, ...data } : sd)) })),
      deleteSkillSubdomain: (id) =>
        set((s) => ({ skillSubdomains: s.skillSubdomains.filter((sd) => sd.id !== id) })),

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
      version: 2,
      // The v1 -> v2 schema change (SKBH pricing, skill taxonomy, consent
      // records) is not backwards compatible with anything persisted under
      // v1 — discard old state on the version bump so the app reseeds clean.
      migrate: (persistedState, version) => (version < 2 ? ({} as Store) : (persistedState as Store)),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
