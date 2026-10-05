import type { ReactNode } from "react";

import { logoutAction } from "@/features/admin/logout.action";

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <div>
            <p className="text-sm font-semibold text-brand">Whimsey Technologies</p>
            <p className="text-xs text-muted">Payments</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden text-sm text-muted sm:block">{email}</p>
            <form action={logoutAction}>
              <button type="submit" className="text-sm font-medium text-foreground transition duration-300 hover:text-brand">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</div>
    </div>
  );
}
