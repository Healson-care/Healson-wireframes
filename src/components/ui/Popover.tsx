"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Keeps the panel clear of the screen edges on small viewports.
const VIEWPORT_MARGIN = 8;
const PANEL_WIDTH = 288; // w-72
const ANCHOR_GAP = 8;

export function Popover({
  trigger,
  children,
  align = "start",
  className,
  block,
}: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
  /**
   * Let the trigger fill its parent instead of sizing to its own content.
   *
   * The default `inline-block` shrink-wraps, which silently defeats any
   * `truncate` inside the trigger: nothing ever overflows a box that grows to
   * fit. A trigger sitting in a grid track (the search gates) must instead be
   * `block w-full min-w-0`, so the track's width wins and long values are cut
   * rather than pushing their neighbours out of the row.
   */
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: PANEL_WIDTH });
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // The panel is portaled to <body> and positioned `fixed` from the trigger's
  // rect — an `overflow-hidden` ancestor (e.g. the height-animated expanding
  // card sections) can therefore never clip it, and we can clamp it to the
  // viewport on narrow screens.
  useEffect(() => {
    if (!open) return;
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
      // RTL-friendly: "start" hangs the panel off the trigger's right edge,
      // "end" off its left edge — same visual behavior the old absolute
      // positioning had, minus the overflow.
      let left = align === "end" ? anchor.left : anchor.right - width;
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));
      let top = anchor.bottom + ANCHOR_GAP;
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      const overflowsBottom = top + panelHeight > window.innerHeight - VIEWPORT_MARGIN;
      const fitsAbove = anchor.top - ANCHOR_GAP - panelHeight >= VIEWPORT_MARGIN;
      if (overflowsBottom && fitsAbove) top = anchor.top - ANCHOR_GAP - panelHeight;
      setPos({ top, left, width });
    }
    place();
    window.addEventListener("resize", place);
    // capture: also fires for scrolling ancestors, not just the window
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={anchorRef} className={cn("relative", block ? "block w-full min-w-0" : "inline-block")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(block && "focus-ring block w-full min-w-0")}
      >
        {trigger}
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                style={{ top: pos.top, left: pos.left, width: pos.width }}
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className={cn("fixed z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-lg", className)}
              >
                {children(() => setOpen(false))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
