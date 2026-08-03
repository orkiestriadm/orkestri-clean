import { Container } from "@/components/ui/container";

/**
 * Logo cloud — "empresas que confiam" (doc 04 / 05).
 * Neutral wordmark placeholders until real client logos are provided.
 */
const segments = [
  "Logística",
  "Concessionárias",
  "Indústria",
  "Transportes",
  "Agronegócio",
  "Saúde",
];

export function LogoCloud() {
  return (
    <section className="py-14">
      <Container>
        <p className="text-center text-sm font-medium text-gray-400">
          Empresas de diferentes segmentos confiam em tecnologia para crescer
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {segments.map((s) => (
            <span
              key={s}
              className="text-lg font-semibold tracking-tight text-gray-300"
            >
              {s}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}
