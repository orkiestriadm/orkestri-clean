import Link from "next/link";
import { Faixa, Cabecalho } from "./ui";
import { DemoConversa } from "@/components/aurelia/demo-conversa";
import { TOTAL_PEDIDOS } from "@/config/aurelia";

/**
 * "Experimente antes de se cadastrar", na home.
 *
 * Entrou no lugar do primeiro `AureliaGallery` (03/11/2026). A home trazia a
 * MESMA galeria duas vezes — "Veja a Aurélia em ação" e "Do WhatsApp para a
 * sua rotina" —, com os mesmos três passos e os mesmos três prints, mudando
 * só o texto de apoio. A segunda continua, porque é ela que explica o
 * cadastro; a primeira virou isto, que mostra o produto funcionando em vez
 * de descrevê-lo.
 *
 * Os prints reais não se perdem: a galeria logo abaixo segue com eles.
 */
export function Experimentar() {
  return (
    <Faixa id="experimentar" tom="raise">
      <Cabecalho
        titulo="Experimente antes de se cadastrar."
        texto={
          <>
            Toque num pedido e veja o que a Aurélia responde. São frases que
            ela entende de verdade — e há{" "}
            <Link
              href="/o-que-pedir"
              className="text-flame-soft underline decoration-flame/40 decoration-1 underline-offset-4 transition-colors hover:text-ember"
            >
              outras {TOTAL_PEDIDOS - 1} na parede de pedidos
            </Link>
            .
          </>
        }
      />
      <div className="mt-12">
        <DemoConversa />
      </div>
    </Faixa>
  );
}
