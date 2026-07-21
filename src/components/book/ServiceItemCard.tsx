"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Clock, Users } from "lucide-react";

export function ServiceItemCard({
  name,
  durationMinutes,
  providerCount,
  tag,
  onSelect,
}: {
  name: string;
  durationMinutes: number;
  // Omitted when the list is already scoped to one doctor (e.g. browsing
  // that doctor's own services) — showing "1 רופא/ה מציע/ה" there is noise.
  providerCount?: number;
  tag?: string;
  onSelect: () => void;
}) {
  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{name}</p>
        <p className="mt-1 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {durationMinutes} דק׳
          </span>
          {providerCount != null && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {providerCount} {providerCount === 1 ? "רופא/ה מציע/ה" : "רופאים מציעים"}
            </span>
          )}
          {tag && <span className="rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">{tag}</span>}
        </p>
      </div>
      <ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-0.5" />
    </motion.button>
  );
}
