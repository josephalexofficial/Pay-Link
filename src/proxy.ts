import { NextResponse, type NextRequest } from "next/server";

import { readAuthSecret } from "@/common/config/env";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/features/admin/session-token";

/**
 * Sends unsigned visitors from the admin pages back to sign-in.
 * The dashboard layout checks the same cookie again before reading payments.
 *
 * @param request - Incoming admin request.
 * @returns The original response, or a redirect to /admin/login.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const secret = readAuthSecret();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = secret && token ? await readSessionToken(token, secret) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
