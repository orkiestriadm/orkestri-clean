import { Faixa } from "./ui";

/**
 * Pilha tecnológica.
 *
 * Antes eram quinze pílulas soltas numa linha — um saco de nomes, sem dizer
 * o papel de nenhum. Agrupadas por função, a mesma lista passa a informar:
 * dá para ver que há nuvem, aplicação, dados e modelos de IA, e onde cada
 * nome entra. A estrutura carrega a informação em vez de só enfeitar.
 */
const grupos = [
  { papel: "Nuvem e infraestrutura", itens: ["AWS", "Azure", "Google Cloud", "Docker"] },
  { papel: "Aplicação", itens: ["TypeScript", "Next.js", "React", "Node.js"] },
  { papel: "Dados e mensageria", itens: ["PostgreSQL", "SQL Server", "Redis", "RabbitMQ"] },
  { papel: "Modelos de IA", itens: ["Claude", "OpenAI", "Gemini"] },
];

export function Tecnologias() {
  return (
    <Faixa id="tecnologia" className="py-16 md:py-20">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {grupos.map((g) => (
          <div key={g.papel}>
            <h3 className="text-[0.8125rem] font-medium text-chalk-faint">
              {g.papel}
            </h3>
            <ul className="mt-3 flex flex-col gap-1.5">
              {g.itens.map((i) => (
                <li key={i} className="text-[0.9375rem] text-chalk-dim">
                  {i}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Faixa>
  );
}
