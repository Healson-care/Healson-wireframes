"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Minimal click-outside popover menu — the "avatar in the top-right corner"
 * pattern most real SaaS apps use for account/profile access, which this
 * codebase didn't have a primitive for yet. */
export function DropdownMenu({ trigger, children, align = "start" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center">
        {trigger}
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full z-40 mt-2 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg",
            align === "end" ? "left-0" : "right-0"
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({ children, onClick, href, className }: { children: ReactNode; onClick?: () => void; href?: string; className?: string }) {
  const classes = cn("flex w-full items-center gap-2 px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50 text-right", className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
