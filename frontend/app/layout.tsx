import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autonomous Research Chat",
  description: "Chat interface for autonomous research agents and report artifacts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
