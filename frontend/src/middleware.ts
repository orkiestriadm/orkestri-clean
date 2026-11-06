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
  // A presença do cookie não prova que a sessão ainda é válida.
  // A recuperação permite abrir o formulário sem depender da API de limpeza.
  if (pathname === "/login" && token && request.nextUrl.searchParams.get("reauth") !== "1") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
