import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { readAuthSecret } from "@/common/config/env";
import { LoginForm } from "@/features/admin/components/LoginForm";
import { getAdminSession } from "@/features/admin/admin-session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <p className="mb-8 text-center text-xl font-semibold tracking-tight text-brand">Whimsey Technologies</p>
        <LoginForm isConfigured={Boolean(readAuthSecret())} />
      </div>
    </main>
  );
}
