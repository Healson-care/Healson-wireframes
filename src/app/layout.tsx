import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HEALSON | פלטפורמת בריאות",
  description: "פלטפורמת ניהול וזימון שירותי בריאות בישראל",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
