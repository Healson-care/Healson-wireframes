import { formatDateHe } from "@/lib/utils";

type ReminderAppointment = {
  client_name: string;
  date: string;
  time: string;
  service_name: string;
  provider_name: string;
};

export interface ReminderSettings {
  enabled: boolean;
  sendTime: string; // "HH:MM" — daily time the automatic send checks fire
  template: string;
  lastAutoSendDate?: string; // yyyy-MM-dd — guards against firing more than once per day
}

export const REMINDER_PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{שם}", label: "שם המטופל" },
  { token: "{תאריך}", label: "תאריך התור" },
  { token: "{שעה}", label: "שעת התור" },
  { token: "{שירות}", label: "שם השירות" },
  { token: "{ספק}", label: "שם הספק" },
];

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  sendTime: "18:00",
  template: "שלום {שם}, מזכירים לך על התור שלך מחר בשעה {שעה} ל{שירות} אצל {ספק}. לביטול/שינוי נא להתקשר אלינו.",
};

export const EXAMPLE_REMINDER_APPOINTMENT: ReminderAppointment = {
  client_name: "דנה כהן",
  date: new Date().toISOString().slice(0, 10),
  time: "10:00",
  service_name: "ייעוץ אורתופדי",
  provider_name: 'ד"ר לוי',
};

export function renderReminderTemplate(template: string, appointment: ReminderAppointment): string {
  return template
    .replaceAll("{שם}", appointment.client_name)
    .replaceAll("{תאריך}", formatDateHe(appointment.date))
    .replaceAll("{שעה}", appointment.time)
    .replaceAll("{שירות}", appointment.service_name)
    .replaceAll("{ספק}", appointment.provider_name);
}
