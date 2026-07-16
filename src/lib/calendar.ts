// Shared month-grid math + appointment status colors for the admin calendar
// views (general /appointments board and the per-patient chart's תורים tab)
// so both stay visually and behaviorally in sync.

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Full weeks (multiples of 7) covering the given month, including the
 * leading/trailing days of adjacent months needed to fill the grid. */
export function monthGridDays(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const gridStart = addDays(first, -startWeekday);
  return Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i));
}

export const WEEKDAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export const APPOINTMENT_CHIP_TONE: Record<string, string> = {
  "ממתין לתשלום מקדמה": "bg-amber-50 text-amber-700 border-amber-200",
  "מאושר": "bg-blue-50 text-blue-700 border-blue-200",
  "שולם במלואו": "bg-purple-50 text-purple-700 border-purple-200",
  "בוצע": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "בוטל": "bg-rose-50 text-rose-700 border-rose-200 line-through",
};
