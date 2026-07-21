"use client";

import { ReactNode, createContext, useContext, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface TabsContext {
  value: string;
  setValue: (v: string) => void;
  /** Base for deterministic tab/panel ids so aria-controls/labelledby can be
   * wired without every caller inventing ids. */
  baseId: string;
}

const Ctx = createContext<TabsContext | null>(null);

const tabId = (baseId: string, value: string) => `${baseId}-tab-${value}`;
const panelId = (baseId: string, value: string) => `${baseId}-panel-${value}`;

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const baseId = useId();
  const value = controlledValue ?? internal;
  const setValue = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };
  return (
    <Ctx.Provider value={{ value, setValue, baseId }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  // Roving tabindex: the active trigger is the only Tab stop; arrows move
  // between tabs (direction-aware, the app is RTL) and activate on focus.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    );
    if (tabs.length === 0) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const from = current >= 0 ? current : tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    let next: number;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else {
      const delta = (e.key === "ArrowRight") !== rtl ? 1 : -1;
      next = (Math.max(from, 0) + delta + tabs.length) % tabs.length;
    }
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  }
  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn("flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1", className)}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  icon,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={tabId(ctx.baseId, value)}
      aria-selected={active}
      aria-controls={panelId(ctx.baseId, value)}
      tabIndex={active ? 0 : -1}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "focus-ring flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");
  if (ctx.value !== value) return null;
  return (
    <div
      role="tabpanel"
      id={panelId(ctx.baseId, value)}
      aria-labelledby={tabId(ctx.baseId, value)}
      className={className}
    >
      {children}
    </div>
  );
}
