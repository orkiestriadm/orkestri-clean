import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware de autenticação server-side.
 * Redireciona para /login se não houver token ao acessar /dashboard.
 * Redireciona para /dashboard se já houver token ao acessar /login.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get("orkestri_token")?.value;
  const { pathname } = request.nextUrl;

  // Protege todas as rotas /dashboard
  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Se já logado, redireciona /login para /dashboard
  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
