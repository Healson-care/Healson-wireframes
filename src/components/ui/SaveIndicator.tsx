"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Subtle inline "נשמר" flash for auto-saving settings surfaces. The decided
 * save policy: quick settings (availability, toggles, inline status changes)
 * auto-save and confirm with this indicator; long forms keep an explicit save
 * button + toast. Call the returned `flash()` after every successful write. */
export function useSaveFlash(duration = 2000): [boolean, () => void] {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback(() => {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), duration);
  }, [duration]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  return [visible, flash];
}

/** The wrapper stays mounted (role="status") so screen readers announce the
 * text when it appears. */
export function SaveIndicator({ visible, className }: { visible: boolean; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex min-w-0", className)}>
      <AnimatePresence>
        {visible && (
          <motion.span
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-success-text"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            נשמר
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
