"use client";

import type { ReactNode } from "react";

/**
 * Estado vazio FORA de tabela.
 *
 * O `EmptyState` do data-ui renderiza `<tr><td colSpan>` — só funciona dentro
 * de `<tbody>`. As telas do Meu RH são painéis, não grades: usá-lo aqui
 * produziria `<tr>` solto, que o navegador descarta em silêncio.
 */
export default function Vazio({
  icon, titulo, dica,
}: {
  icon?: ReactNode;
  titulo: string;
  dica?: string;
}) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-state__icon">{icon}</span>}
      <span className="empty-state__title">{titulo}</span>
      {dica && <span className="empty-state__hint">{dica}</span>}
    </div>
  );
}
