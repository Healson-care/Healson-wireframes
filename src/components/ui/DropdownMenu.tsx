"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Minimal click-outside popover menu — the "avatar in the top-right corner"
 * pattern most real SaaS apps use for account/profile access. Fully keyboard
 * operable: Enter/Space/ArrowDown open and focus the first item, arrows cycle,
 * Escape closes and returns focus to the trigger, Tab closes. */
export function DropdownMenu({ trigger, children, align = "start" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Focus lands on the first item as soon as the menu opens, so keyboard
  // users are inside the menu immediately (mouse users won't notice).
  useEffect(() => {
    if (!open) return;
    const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

  function menuItems(): HTMLElement[] {
    return Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    if (!open) {
      setOpen(true);
      return;
    }
    const items = menuItems();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const delta = e.key === "ArrowDown" ? 1 : -1;
    const next = (Math.max(current, 0) + delta + items.length) % items.length;
    items[next].focus();
  }

  return (
    <div ref={ref} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring flex items-center rounded-lg"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
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
  const classes = cn(
    "flex w-full items-center gap-2 px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50 text-right outline-none focus:bg-slate-100",
    className
  );
  if (href) {
    return (
      <Link href={href} role="menuitem" tabIndex={-1} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" tabIndex={-1} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
