// The money side of a single appointment, as the provider portal shows it
// (payments meeting 02.08.2026, §7 "חיווי מצב תשלום על כל תור").
//
// Nothing here is stored: the state is derived every render from the primitives
// on the Appointment (funding route, deposit, commitment document, balance and
// who collects it), so a booking can never drift out of sync with a status the
// store wrote — the same reason prices are derived rather than duplicated.
import {
  Appointment,
  AppointmentPaymentState,
  BALANCE_COLLECTOR_LABELS,
  BalanceCollector,
  isCancelledAppointment,
} from "@/types";
import { formatCurrency } from "./utils";

/** Routes that are settled with a commitment document instead of money:
 * route S always (סל הקופה — טופס 17), and route B when the insurer issued a
 * commitment (mostly surgery). B without one is an ordinary refund route and
 * pays a deposit like everyone else. */
export function usesCommitment(a: Appointment): boolean {
  if (a.funding_layer === "S") return true;
  return a.funding_layer === "B" && (!!a.commitment_document || a.status === "ממתין להתחייבות");
}

export function balanceCollectorOf(a: Appointment): BalanceCollector {
  return a.balance_collector ?? "healson";
}

/** The one payment fact worth putting on a calendar block. */
export function getAppointmentPaymentState(a: Appointment): AppointmentPaymentState {
  if (isCancelledAppointment(a.status)) return "בוטל";

  if (usesCommitment(a)) {
    return a.commitment_document ? "התחייבות הועלתה" : "ממתין להתחייבות";
  }

  if (!a.deposit_paid_at) return "ממתין למקדמה";
  if (a.balance_paid_at || a.status === "שולם במלואו") return "יתרה שולמה";

  const balance = a.balance_amount ?? 0;
  if (balance <= 0) return "מקדמה שולמה";
  if (balanceCollectorOf(a) === "unit") return 'נגבית ע"י היחידה';
  return a.status === "ממתין לתשלום יתרה" ? "יתרה ממתינה" : "מקדמה שולמה";
}

/** Badge tone for a payment state — money that still has to arrive is amber,
 * money that arrived is green, and a commitment is its own (blue) axis because
 * it is paperwork rather than payment. */
export function paymentStateTone(
  state: AppointmentPaymentState
): "green" | "amber" | "blue" | "slate" {
  switch (state) {
    case "יתרה שולמה":
      return "green";
    case "מקדמה שולמה":
    case "התחייבות הועלתה":
      return "blue";
    case "ממתין למקדמה":
    case "ממתין להתחייבות":
    case "יתרה ממתינה":
      return "amber";
    default:
      return "slate";
  }
}

/** "1,600 ₪ · חיוב אוטומטי ב-04/08 עד 12:00" — the one line that answers
 * "when does the rest of the money arrive, and from where". */
export function balanceLine(a: Appointment): string | null {
  const balance = a.balance_amount ?? 0;
  if (usesCommitment(a) || balance <= 0) return null;

  const amount = formatCurrency(balance);
  if (a.balance_paid_at) return `${amount} · נגבתה`;
  if (balanceCollectorOf(a) === "unit") {
    return `${amount} · ${BALANCE_COLLECTOR_LABELS.unit}`;
  }
  return a.balance_due_at
    ? `${amount} · חיוב אוטומטי ב-${formatBalanceDue(a.balance_due_at)}`
    : `${amount} · חיוב אוטומטי יום לפני התור`;
}

/** Balance due dates are always "the day before, 12:00" — show the date and
 * the hour, not a full timestamp. */
export function formatBalanceDue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return `${date} עד ${time}`;
}

/** The deadline Healson charges the balance on: 12:00 of the day before the
 * appointment. Kept here so seeds, the diary and any future job agree. */
export function balanceDueAt(appointmentDate: string): string {
  const d = new Date(`${appointmentDate}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

/** True when the booking is sitting in the unit's referral-approval queue. */
export function awaitsUnitApproval(a: Appointment): boolean {
  return a.status === "ממתין לאישור הפניה";
}
