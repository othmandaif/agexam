import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/lib/routes";
import { redirectKeepingCookies, updateSession } from "@/server/supabase/proxy-session";

/** Chemins accessibles sans être connecté. */
const PUBLIC_PATHS = [ROUTES.login, "/api/health"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Proxy (ex-middleware) : rafraîchit la session et redirige les visiteurs non connectés.
 *
 * ATTENTION : ce n'est qu'un confort de navigation. Le contrôle d'accès réel
 * (rôle, appartenance au groupe, propriété de la tentative) est fait dans les
 * layouts, les Server Actions et les routes API via src/server/auth.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!userId && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Connexion requise." } },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.login;
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return redirectKeepingCookies(url, response);
  }

  if (userId && pathname === ROUTES.login) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectKeepingCookies(url, response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
