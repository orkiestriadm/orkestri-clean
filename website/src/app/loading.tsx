import { Container } from "@/components/ui/container";

/** Route-level loading skeleton (doc 07 / 08 — never a bare spinner). */
export default function Loading() {
  return (
    <Container className="pt-40 pb-20">
      <div className="animate-pulse space-y-6">
        <div className="h-4 w-32 rounded-full bg-gray-100" />
        <div className="h-14 w-3/4 rounded-2xl bg-gray-100" />
        <div className="h-14 w-1/2 rounded-2xl bg-gray-100" />
        <div className="h-5 w-2/3 rounded-full bg-gray-100" />
        <div className="grid gap-4 pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-(--radius-card) bg-gray-100" />
          ))}
        </div>
      </div>
    </Container>
  );
}
