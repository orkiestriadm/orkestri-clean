"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Centralized logging would go here (doc 09 — no console.log in prod).
  }, [error]);

  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center py-32 text-center">
      <span className="text-sm font-semibold uppercase tracking-wider text-primary">
        Erro 500
      </span>
      <h1 className="mt-4 text-[2.5rem] font-bold text-dark md:text-[3.5rem]">
        Algo deu errado
      </h1>
      <p className="mt-4 max-w-md text-lg text-gray-600">
        Encontramos um problema inesperado. Tente novamente em alguns instantes.
      </p>
      <div className="mt-8">
        <Button size="lg" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    </Container>
  );
}
