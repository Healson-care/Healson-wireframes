"use client";

import { useStore } from "@/lib/store";

export function useCurrentPatient() {
  const currentUser = useStore((s) => s.currentUser);
  const patients = useStore((s) => s.patients);
  if (!currentUser) return null;
  return (
    patients.find((p) => p.user_id === currentUser.id) ??
    patients.find((p) => p.email === currentUser.email) ??
    null
  );
}

export function useCurrentProvider() {
  const currentUser = useStore((s) => s.currentUser);
  const providers = useStore((s) => s.providers);
  if (!currentUser) return null;
  return providers.find((p) => p.user_id === currentUser.id) ?? null;
}
