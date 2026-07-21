"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "danger" | "info";

const BAR_TONE: Record<Tone, string> = {
  primary: "bg-gradient-to-l from-primary to-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

const RING_TONE: Record<Tone, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
};

/** Thin animated percent-complete bar, reusable wherever a screen needs a
 * width-animated progress line (e.g. the provider dashboard hero). */
export function ProgressBar({
  percent,
  tone = "primary",
  className,
}: {
  percent: number;
  tone?: Tone;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <motion.div
        className={cn("h-full rounded-full", BAR_TONE[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

/** SVG percent-complete ring for hero cards — a more glanceable alternative to
 * a plain "80%" text figure when the surrounding card already has room for it. */
export function ProgressRing({
  percent,
  size = 64,
  strokeWidth = 8,
  tone = "primary",
  label,
  trackClassName,
  textClassName,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  tone?: Tone;
  label?: string;
  trackClassName?: string;
  textClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn("stroke-slate-200/40", trackClassName)}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RING_TONE[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-sm font-bold tabular-nums", textClassName)}>{clamped}%</span>
        {label && <span className={cn("text-[9px] leading-tight opacity-80", textClassName)}>{label}</span>}
      </div>
    </div>
  );
}
