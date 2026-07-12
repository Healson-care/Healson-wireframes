This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Product notes: appointment status model

`AppointmentStatus` (`src/types/index.ts`) models the booking lifecycle from
the patient's point of view:

```
ממתין לתשלום מקדמה -> מאושר -> שולם במלואו -> בוצע
                          \
                           -> בוטל (reachable from any state before בוצע)
```

- **ממתין לתשלום מקדמה** — a slot was picked; the Appointment record is
  created immediately (before payment), so it shows up in the patient's
  history even if they never pay.
- **מאושר** — the deposit (`מקדמה`, 30%) was paid successfully.
- **שולם במלואו** — the remaining balance (`יתרה`, 70%) was paid, via the
  "שלם יתרה" button on the appointment card in `/client/appointments`.
- **בוצע** — the service was actually rendered (provider marks this).
- **בוטל** — cancelled by patient/admin/provider, or a payment hold expired
  unpaid.

**Open/unresolved (as of 2026-07-12):** nothing currently happens if an
appointment's date arrives while its balance is still unpaid (status stuck
at `מאושר`). This is a fully local mock app with no backend/cron, so any
enforcement (warning banner? auto-cancel? blocking check-in?) would need to
be computed client-side when a relevant page loads — not decided yet.

Also not wired up: `Order.payment_status` already has a `"שולם במלואו"`
value in its own enum, but paying the balance via the appointment-page
button above does **not** update the matching `Order` (there's no
`appointment_id` link between the two records to find it). Order-level
payment status remains whatever it was set to at booking time.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
