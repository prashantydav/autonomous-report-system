import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Portfolio & Resume Generator",
  description: "Resume upload, portfolio generation, resume regeneration, and direct Vercel deployment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
