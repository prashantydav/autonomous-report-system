import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autonomous Research System",
  description: "Chat-style interface for autonomous research and report generation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
