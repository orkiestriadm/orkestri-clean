import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center py-32 text-center">
      <span className="text-sm font-semibold uppercase tracking-wider text-primary">
        Erro 404
      </span>
      <h1 className="mt-4 text-[3rem] font-bold text-dark md:text-[4rem]">
        Página não encontrada
      </h1>
      <p className="mt-4 max-w-md text-lg text-gray-600">
        A página que você procura não existe ou foi movida. Vamos te levar de
        volta ao caminho certo.
      </p>
      <div className="mt-8">
        <Button asChild size="lg">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </Container>
  );
}
