import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Appointment,
  CatalogItem,
  Lead,
  LabReferral,
  Order,
  Patient,
  ProviderProfile,
  Role,
  ToastItem,
  User,
} from "@/types";
import {
  SEED_APPOINTMENTS,
  SEED_BRANCHES,
  SEED_CATALOG,
  SEED_LAB_REFERRALS,
  SEED_LEADS,
  SEED_ORDERS,
  SEED_PATIENTS,
  SEED_PROVIDERS,
  SEED_USERS,
} from "./mock-data";
import { generateId } from "./utils";

// ---------------------------------------------------------------------------
// Auth slice
// ---------------------------------------------------------------------------
interface PendingRegistration {
  email: string;
  password: string;
  otp: string;
}

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
  quickRegisterPatient: (data: { full_name: string; phone: string; email: string }) => Patient;
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
  appointments: Appointment[];
  orders: Order[];
  labReferrals: LabReferral[];
  branches: typeof SEED_BRANCHES;

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

  addAppointment: (a: Omit<Appointment, "id">) => Appointment;
  updateAppointment: (id: string, data: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;

  addOrder: (o: Omit<Order, "id" | "created_date">) => Order;
  updateOrder: (id: string, data: Partial<Order>) => void;

  addLabReferral: (r: Omit<LabReferral, "id" | "created_date">) => LabReferral;
  updateLabReferral: (id: string, data: Partial<LabReferral>) => void;

  addCatalogItem: (c: Omit<CatalogItem, "id">) => CatalogItem;
  bulkAddCatalogItems: (items: Omit<CatalogItem, "id">[]) => number;
  bulkAddProviders: (items: Omit<ProviderProfile, "id" | "created_date">[]) => number;
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
        get().addPatient({
          full_name: newUser.full_name,
          email: newUser.email,
          kupah: "כללית",
          status: "פעיל",
          user_id: newUser.id,
        });
        return { ok: true };
      },

      resendOtp: () => {
        const pending = get().pendingRegistration;
        return pending ? pending.otp : null;
      },

      forgotPassword: () => ({ ok: true }),
      resetPassword: () => ({ ok: true }),

      logout: () => set({ currentUser: null }),

      quickRegisterPatient: (data) => {
        const existingPatient = get().patients.find(
          (p) => p.email && p.email.toLowerCase() === data.email.toLowerCase()
        );
        if (existingPatient) {
          const existingUser = get().users.find((u) => u.id === existingPatient.user_id);
          if (existingUser) set({ currentUser: existingUser });
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
        return get().addPatient({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          kupah: "כללית",
          status: "פעיל",
          user_id: newUser.id,
        });
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
      appointments: SEED_APPOINTMENTS,
      orders: SEED_ORDERS,
      labReferrals: SEED_LAB_REFERRALS,
      branches: SEED_BRANCHES,

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
    }),
    {
      name: "healson-platform-store",
      version: 1,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
