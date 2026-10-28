import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware de autenticação server-side.
 * Redireciona para /login se não houver token ao acessar /dashboard.
 * A presença do cookie não comprova uma sessão válida: /login deve continuar
 * acessível para renovar cookies expirados ou revogados.
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
