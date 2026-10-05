import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminShell } from "@/features/admin/components/AdminShell";
import { getAdminSession } from "@/features/admin/admin-session";

export const metadata: Metadata = {
  title: "Payments",
};

export default async function AdminPortalLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return <AdminShell email={session.email}>{children}</AdminShell>;
}
