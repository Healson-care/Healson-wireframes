"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function PatientTypeToggle({ active }: { active: "new" | "existing" }) {
  const router = useRouter();

  return (
    <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => router.push("/register")}
        className={cn(
          "rounded-md py-2 text-sm font-medium transition-colors",
          active === "new" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        )}
      >
        מטופל חדש
      </button>
      <button
        type="button"
        onClick={() => router.push("/login")}
        className={cn(
          "rounded-md py-2 text-sm font-medium transition-colors",
          active === "existing" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        )}
      >
        מטופל קיים
      </button>
    </div>
  );
}
