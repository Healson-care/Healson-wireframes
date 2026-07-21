"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);

  return (
    <div className="fixed bottom-20 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={cn(
              "flex items-start gap-2 rounded-lg border bg-white p-3 shadow-lg",
              t.variant === "destructive" && "border-danger-border",
              t.variant === "success" && "border-success-border",
              (!t.variant || t.variant === "default") && "border-slate-200"
            )}
          >
            {t.variant === "destructive" ? (
              <AlertCircle className="h-5 w-5 text-danger shrink-0" />
            ) : t.variant === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : (
              <Info className="h-5 w-5 text-primary shrink-0" />
            )}
            <div className="flex-1 text-sm">
              <p className="font-medium text-slate-900">{t.title}</p>
              {t.description && <p className="text-slate-500 mt-0.5">{t.description}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
