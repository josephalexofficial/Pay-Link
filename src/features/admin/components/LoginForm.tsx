"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/features/admin/login.action";

const INITIAL_STATE: LoginState = { error: null };

const FIELD_CLASS_NAME =
  "h-14 w-full rounded-xl border border-line bg-white px-4 text-base text-foreground outline-none transition duration-300 placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10";

export function LoginForm({ isConfigured }: { isConfigured: boolean }) {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form
      action={formAction}
      className="rise-in rounded-2xl border border-line border-t-4 border-t-brand bg-card px-6 py-7 shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
    >
      <h1 className="text-[1.7rem] font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Sign in to see M-Pesa payments.</p>

      <label className="mt-7 block text-sm font-medium" htmlFor="email">
        Email
      </label>
      <input id="email" name="email" type="email" autoComplete="username" required className={`mt-2 ${FIELD_CLASS_NAME}`} />

      <label className="mt-5 block text-sm font-medium" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className={`mt-2 ${FIELD_CLASS_NAME}`}
      />

      {state.error ? <p className="mt-4 text-sm leading-6 text-danger">{state.error}</p> : null}
      {!isConfigured ? (
        <p className="mt-4 text-sm leading-6 text-muted">Add AUTH_SECRET, then seed the admin user before signing in.</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !isConfigured}
        className="mt-6 h-14 w-full rounded-xl bg-brand text-base font-medium text-white transition duration-300 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
