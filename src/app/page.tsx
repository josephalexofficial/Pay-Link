import type { Metadata } from "next";

import { PayForm } from "@/features/payments/components/PayForm";

export const metadata: Metadata = {
  title: "Pay · Whimsey Technologies",
  description: "Pay Whimsey Technologies with M-Pesa.",
};

export default function PayPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <p className="mb-8 text-center text-xl font-semibold tracking-tight text-brand">Whimsey Technologies</p>
        <PayForm />
      </div>
    </main>
  );
}
