import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faraj Alorfi — Signals, Systems, Intelligence",
  description: "The personal portfolio of Faraj Alorfi — IT support, communications, and AI-assisted product development.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
