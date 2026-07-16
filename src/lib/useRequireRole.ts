"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Role } from "@/types";

const HOME_BY_ROLE: Record<Role, string> = {
  admin: "/dashboard",
  provider: "/provider/dashboard",
  patient: "/client",
};

/**
 * Client-side route guard. Mock app has no server-side sessions, so role
 * checks happen after hydration; we briefly show a spinner to avoid a
 * flash of unauthorized content.
 */
export function useRequireRole(role: Role) {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const hasHydrated = useStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!currentUser) {
      // Patients have their own login/register page; this also wins the
      // race against a manual "התנתק" button that tries to navigate
      // elsewhere right after calling logout() — this effect fires from
      // the currentUser change and would otherwise clobber that navigation.
      router.replace(role === "patient" ? "/client/login" : "/login");
    } else if (currentUser.role !== role) {
      router.replace(HOME_BY_ROLE[currentUser.role]);
    }
  }, [hasHydrated, currentUser, role, router]);

  return { user: currentUser, ready: hasHydrated && !!currentUser && currentUser.role === role };
}

export function homeForRole(role: Role): string {
  return HOME_BY_ROLE[role];
}
