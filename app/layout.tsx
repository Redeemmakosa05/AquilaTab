import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AquilaTab — Scan. Split. Settle.",
  description:
    "AI-powered item-level bill splitting and independent PayPal Sandbox merchant payments.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
