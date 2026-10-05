import type { Metadata } from "next";
import { Jost } from "next/font/google";

import "./globals.css";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Pay · Whimsey Technologies",
    template: "%s · Whimsey Technologies",
  },
  description: "Pay Whimsey Technologies with M-Pesa.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jost.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
