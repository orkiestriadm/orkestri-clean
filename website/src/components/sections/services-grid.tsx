import { services } from "@/config/services";
import { ServiceCard } from "@/components/cards/service-card";
import { Reveal } from "@/components/animations/reveal";

/** Grid of services — reused on Home and Services page. */
export function ServicesGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {services.map((s, i) => (
        <Reveal key={s.slug} delay={(i % 3) * 0.05}>
          <ServiceCard service={s} />
        </Reveal>
      ))}
    </div>
  );
}
