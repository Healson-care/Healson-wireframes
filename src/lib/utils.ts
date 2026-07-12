type ClassValue = string | number | bigint | null | undefined | false | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat(3)
    .filter(Boolean)
    .join(" ");
}

let counter = 0;
export function generateId(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function formatCurrency(value: number): string {
  return `₪${Math.round(value).toLocaleString("he-IL")}`;
}

export function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateHe(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("he-IL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Standard Israeli teudat zehut checksum (9 digits, weighted mod-10). */
export function isValidIsraeliId(id: string): boolean {
  const cleaned = id.trim();
  if (!/^\d{1,9}$/.test(cleaned)) return false;
  const padded = cleaned.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const weighted = Number(padded[i]) * ((i % 2) + 1);
    sum += weighted > 9 ? weighted - 9 : weighted;
  }
  return sum % 10 === 0;
}

export function initials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts[0][0];
}

const HE_MONTHS = [
  "ינו",
  "פבר",
  "מרץ",
  "אפר",
  "מאי",
  "יונ",
  "יול",
  "אוג",
  "ספט",
  "אוק",
  "נוב",
  "דצמ",
];

export function buildIcsDataUrl(opts: {
  title: string;
  description?: string;
  location?: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  durationMinutes: number;
}): string {
  const start = new Date(`${opts.date}T${opts.time}:00`);
  const end = new Date(start.getTime() + opts.durationMinutes * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HEALSON//Booking//HE",
    "BEGIN:VEVENT",
    `UID:${generateId("evt")}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${opts.title}`,
    opts.description ? `DESCRIPTION:${opts.description}` : "",
    opts.location ? `LOCATION:${opts.location}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function isInMonth(dateStr: string | undefined, monthsAgo: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
}

/** % change of a numeric metric (count or sum) between this month and last month. */
export function monthOverMonthTrend<T>(
  items: T[],
  dateField: (item: T) => string | undefined,
  valueField: (item: T) => number = () => 1
): number {
  const current = items.filter((i) => isInMonth(dateField(i), 0)).reduce((sum, i) => sum + valueField(i), 0);
  const previous = items.filter((i) => isInMonth(dateField(i), 1)).reduce((sum, i) => sum + valueField(i), 0);
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildMonthlyData<T>(
  items: T[],
  dateField: (item: T) => string | undefined,
  months = 6,
  valueField?: (item: T) => number
): { label: string; count: number }[] {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
    const inMonth = items.filter((item) => {
      const val = dateField(item);
      if (!val) return false;
      const t = new Date(val).getTime();
      return t >= start && t <= end;
    });
    const count = valueField ? inMonth.reduce((sum, item) => sum + valueField(item), 0) : inMonth.length;
    return { label: HE_MONTHS[d.getMonth()], count };
  });
}

/** Groups items by calendar month (yyyy-MM key, newest last) — used for
 * end-of-month provider/admin reports where each month needs several summed
 * metrics at once (unlike buildMonthlyData, which produces a single series). */
export function groupByMonth<T>(
  items: T[],
  dateField: (item: T) => string | undefined,
  months = 6
): { key: string; label: string; items: T[] }[] {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
    const inMonth = items.filter((item) => {
      const val = dateField(item);
      if (!val) return false;
      const t = new Date(val).getTime();
      return t >= start && t <= end;
    });
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${HE_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      items: inMonth,
    };
  });
}

/** Builds a CSV data URL (client-side only, no backend) from rows of plain
 * values — mirrors buildIcsDataUrl's pattern of returning a data: URL an
 * anchor can point at. */
export function buildCsvDataUrl(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + csv)}`;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const a = document.createElement("a");
  a.href = buildCsvDataUrl(headers, rows);
  a.download = filename;
  a.click();
}
