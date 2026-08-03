import { products } from "@/config/products";
import { ProductCard } from "@/components/cards/product-card";
import { Reveal } from "@/components/animations/reveal";

/** Grid of all Orkiestri One apps — reused on Home and Products page. */
export function ProductsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p, i) => (
        <Reveal key={p.slug} delay={(i % 3) * 0.05}>
          <ProductCard product={p} />
        </Reveal>
      ))}
    </div>
  );
}
