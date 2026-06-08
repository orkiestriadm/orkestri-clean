# Agenda — Melhorias visuais pendentes

> Continuação da sessão de hardening visual da agenda. Os 8 quick wins já estão
> em produção (commits a partir de `[hash-deste-commit]`). Este documento
> consolida o que falta para uma agenda de nível profissional comparável a
> Google Calendar / Cal.com.
>
> **Arquivo principal:** `frontend/src/app/dashboard/agenda/page.tsx`
> **Backend correlato:** `backend/src/modules/agenda/agenda.module.ts`

---

## ✅ Já entregue (referência)

1. ~~Diferenciar visualmente feriado vs FDS vs hoje~~ — função `dayVisual()`
2. ~~Linha horizontal indicando hora atual~~ — componente `<NowLine>` + hook `useNow()`
3. ~~Popover "+N eventos" com lista completa~~ — `<MoreEventsPopover>`
5. ~~Paleta semântica + cor customizada~~ — `TIPO_META` + `<input type="color">`
6. ~~Ícones por tipo de evento~~ — `tipoMeta(t).icon`
8. ~~Skeleton de loading~~ — `<CalendarSkeleton>`
9. ~~Empty state~~ — `<EmptyState>`
10. ~~Indicador de conflito~~ — `detectConflicts()` + borda direita vermelha + ⚠️
14. ~~Atalhos de teclado~~ — `useEffect(keydown)` + `<ShortcutsHelp>` (T/J/K/M/W/D/N/?/Esc/Shift+P)
16. ~~Print-friendly view~~ — `@media print`, botão impressão, `.no-print` / `.print-only` / `.agenda-printable`
+ ~~Acessibilidade básica~~ — `aria-label` em ícones, `role="dialog"`, `role="tablist"`, foco visível

---

## 🟢 Item #4 — Altura proporcional do evento + sobreposição lado a lado

**Por quê:** evento de 30 min e evento de 2h ocupam o mesmo espaço hoje. Quando há
dois eventos no mesmo horário, eles ficam empilhados verticalmente sem
distinção. Padrão Google Calendar é exibir lado a lado com altura proporcional
à duração.

**Esforço:** 1-2 dias.

**Onde mexer:**
- `WeekView` e `DayView` em `frontend/src/app/dashboard/agenda/page.tsx`
- Trocar a renderização atual (loop por hora) por **renderização absoluta**
  baseada em `position: absolute` dentro de um container relativo de altura
  `24 * HOUR_HEIGHT`.

**Algoritmo de alocação de colunas:**

```ts
// Pseudo-código
function layoutEvents(events: Event[]) {
  // 1. Ordena por inicio
  const sorted = [...events].sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));

  // 2. Agrupa em "clusters" — eventos que se sobrepõem entre si formam um cluster
  const clusters: Event[][] = [];
  for (const ev of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && last.some(e => overlap(e, ev))) last.push(ev);
    else clusters.push([ev]);
  }

  // 3. Para cada cluster, aloca colunas (algoritmo de interval graph coloring)
  return clusters.flatMap(cluster => {
    const cols: Event[][] = [];
    for (const ev of cluster) {
      let placed = false;
      for (const col of cols) {
        if (!col.some(e => overlap(e, ev))) { col.push(ev); placed = true; break; }
      }
      if (!placed) cols.push([ev]);
    }
    return cluster.map(ev => {
      const colIdx = cols.findIndex(col => col.includes(ev));
      return { event: ev, colIdx, totalCols: cols.length };
    });
  });
}
```

**Render:**
```tsx
const top    = (start.getHours() + start.getMinutes()/60) * HOUR_HEIGHT;
const height = ((end.getTime() - start.getTime()) / 3600_000) * HOUR_HEIGHT;
const widthPct = 100 / totalCols;
const leftPct  = widthPct * colIdx;

<div style={{
  position: "absolute",
  top: `${top}px`,
  height: `${height}px`,
  left: `${leftPct}%`,
  width: `calc(${widthPct}% - 4px)`,
  // ...
}}>
```

**Testes manuais:**
- Criar 3 eventos sobrepostos das 9h-10h, 9h30-11h, 9h45-12h → devem aparecer em
  3 colunas lado a lado.
- Criar evento de 15 minutos → altura = `HOUR_HEIGHT / 4 = 14px`.

---

## 🟢 Item #11 — Mini-calendário lateral

**Por quê:** padrão Google Calendar/Outlook. Navegação rápida + visão de mês
mesmo na vista semanal/diária.

**Esforço:** 4h.

**Implementação:**

Criar componente `<MiniCalendar>` em `frontend/src/components/agenda/MiniCalendar.tsx`:

```tsx
type Props = {
  selectedDate: Date;
  events?: Event[];      // para mostrar pontinhos em dias com evento
  onChange: (d: Date) => void;
};
```

**Layout sugerido:**
- Mês compacto (7 col × 6 linhas), células de 28px × 28px
- Dia atual com fundo violeta
- Dia selecionado com borda violeta
- Dias com evento ganham pontinho (`width: 4px; height: 4px; border-radius: 50%`)
- Header com mês + navegação chevron

**Integração na página:**

Trocar o layout principal para grid `[mini-sidebar 240px | content 1fr]`:

```tsx
<div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
  <aside>
    <MiniCalendar selectedDate={curDate} events={events} onChange={...} />
    <UpcomingEventsList events={events} />
    <FilterPanel /> {/* item #15 */}
  </aside>
  <main>...</main>
</div>
```

Lista de "próximos eventos" (`<UpcomingEventsList>`):
- 5 próximos eventos da semana
- Cada um com cor + ícone + título + horário
- Click → abre detalhe

---

## 🟢 Item #12 — Drag & drop de eventos

**Por quê:** maior "uau" pro usuário. Igual Google. Visual: arrasta evento para
outro horário/dia, solta, atualiza no backend.

**Esforço:** 1-2 dias.

**Stack recomendada:** `@dnd-kit/core` (moderno, leve, acessível). Já tem em
muitos projetos React modernos.

**Pacotes:**
```bash
npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Implementação:**

1. **Wrap das views em `<DndContext>`:**
```tsx
<DndContext onDragEnd={handleDragEnd}>
  <MonthView ... />
</DndContext>
```

2. **Cada evento vira `useDraggable`:**
```tsx
const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: ev.id });
const style = { transform: CSS.Translate.toString(transform) };
return <div ref={setNodeRef} {...listeners} {...attributes} style={style}>...</div>;
```

3. **Cada slot vira `useDroppable`:**
```tsx
const { setNodeRef, isOver } = useDroppable({ id: `slot-${dt.toISOString()}` });
```

4. **Handler:**
```tsx
async function handleDragEnd(e: DragEndEvent) {
  if (!e.over) return;
  const eventId = e.active.id as string;
  const newSlot = (e.over.id as string).replace("slot-", "");
  const newStart = new Date(newSlot);

  // Otimista: atualiza UI primeiro
  setEvents(es => es.map(ev => ev.id === eventId
    ? { ...ev, inicio: newStart.toISOString() }
    : ev
  ));
  // Backend
  try {
    await api.patch(`/agenda/${eventId}/move`, { novoInicio: newStart.toISOString() });
  } catch {
    load(); // reverte
  }
}
```

5. **Backend novo endpoint:**
`PATCH /agenda/:id/move` — recebe `{ novoInicio: ISO string }`, recalcula `fim`
preservando duração, atualiza.

**Bônus:** resize por arrasto da borda inferior (estende duração). Mesmo
pattern, mas o `resizable` é mais raro em libs prontas — pode ser feito
manualmente com `onMouseDown` na borda + `onMouseMove`.

---

## 🟢 Item #13 — Visualização proporcional + overlap

**Já coberto** essencialmente pelo item #4 acima. Junte os dois numa única
entrega.

---

## 🟢 Item #14 — Atalhos de teclado

**Por quê:** baixo custo, alto sinal de "produto profissional".

**Esforço:** 1h.

**Implementação:** hook único na página principal:

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    // ignora se digitando em input/textarea
    if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
    if (e.metaKey || e.ctrlKey) return;

    switch (e.key.toLowerCase()) {
      case "t": goToday(); break;
      case "j": prev(); break;
      case "k": next(); break;
      case "m": setView("mes"); break;
      case "w": setView("semana"); break;
      case "d": setView("dia"); break;
      case "n": setModalNew(toLocalISOStr(new Date())); break;
      case "?": setShowHelp(true); break; // novo
      case "escape": setModalNew(null); setModalEdit(null); setModalDet(null); break;
    }
  };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [view, cur, weekStart, curDate]);
```

**UI de ajuda (`?`):** modal listando os atalhos. Aceita também `mouseover` no
ícone de teclado no canto da tela.

---

## 🟢 Item #15 — Múltiplos calendários sobrepostos com filtros

**Por quê:** equipe quer ver "Meus eventos · Feriados · Equipe X · Projeto Y"
selecionando o que aparece.

**Esforço:** 1-2 dias.

**Modelo de dados (Prisma):**
Tabela `Calendar` (id, nome, cor, organizationId, criadoPorId). Coluna
`calendarId` em `Event` (nullable, default = "Meu calendário pessoal").

**Frontend:**

Sidebar com `<FilterPanel>`:
```tsx
{calendars.map(cal => (
  <label key={cal.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <input type="checkbox"
      checked={activeCalendars.has(cal.id)}
      onChange={() => toggleCal(cal.id)}
      style={{ accentColor: cal.cor }} />
    <span style={{ width: 10, height: 10, borderRadius: 2, background: cal.cor }} />
    <span>{cal.nome}</span>
  </label>
))}
```

Filtragem nos events:
```ts
const visibleEvents = events.filter(e => activeCalendars.has(e.calendarId || "personal"));
```

**Calendários sugeridos por default:**
- Meu calendário pessoal
- Equipe (eventos onde sou participante mas não criei)
- Feriados (gerado, não persistido)
- Projetos (eventos `origemTipo: "projeto"` ou `"task"`)

---

## 🟢 Item #16 — Print-friendly view

**Por quê:** MSP imprime escala da equipe na sala física.

**Esforço:** 2h.

**Implementação:**

CSS no `<style>` no fim do arquivo:

```css
@media print {
  body * { visibility: hidden; }
  .agenda-printable, .agenda-printable * { visibility: visible; }
  .agenda-printable { position: absolute; left: 0; top: 0; width: 100%; }

  .no-print { display: none !important; }     /* botões, filtros, sidebar */
  .card { border: 1px solid #000 !important; box-shadow: none !important; }
  .calendar-event { print-color-adjust: exact; }
}
```

Adicionar classe `agenda-printable` no container principal e `no-print` nos
controles (topbar, sidebar de filtros, botões de ação).

Botão "Imprimir" no topbar → `window.print()`.

---

## 🟢 Bônus — Acessibilidade (não estava na lista mas vale)

- Adicionar `aria-label` em todo `<button className="btn-icon">` que só tem
  ícone SVG
- `<time dateTime={iso}>` em vez de `<div>` para datas/horários (semântica)
- Verificar contraste de cinza claro sobre branco (passar `npx pa11y http://localhost:3000/dashboard/agenda`)
- Foco visível em navegação por Tab (atualmente alguns slots não mostram outline)

**Esforço:** 2h.

---

## 🚀 Sequência sugerida para a próxima sessão

| Ordem | Item | Esforço | Impacto |
|---|---|---|---|
| 1 | #11 — Mini-calendário + Próximos eventos | 4h | Alto |
| 2 | #4+#13 — Altura proporcional + overlap | 1-2 dias | Muito alto |
| 3 | #12 — Drag & drop | 1-2 dias | Muito alto |
| 4 | #15 — Múltiplos calendários | 1-2 dias | Alto |

**Recomendação:** começar por #11 (mais rápido, alta visibilidade). Os pesados
(#4, #12, #15) merecem sessão dedicada cada.

---

## 📚 Referências

- **Algoritmo de overlap:** [Stack Overflow — Calendar event positioning algorithm](https://stackoverflow.com/questions/11311410/visualization-of-calendar-events-algorithm-to-layout-events-with-maximum-width)
- **@dnd-kit docs:** https://docs.dndkit.com
- **FullCalendar** (alternativa drop-in para tudo de uma vez): https://fullcalendar.io/docs/react
- **Cal.com source** (open source, ótimo de referência): https://github.com/calcom/cal.com
- **Google Calendar UX patterns:** observar comportamento real de drag, overlap,
  popover de "+N eventos" antes de codar.

---

## ⚠️ Gotchas conhecidos

1. **Recorrência + drag**: ao arrastar evento recorrente, perguntar "mover só
   esta ocorrência, ou toda a série?". Backend já tem `recurringParentId` —
   usar isso na decisão.

2. **Fuso horário**: eventos hoje são salvos como string ISO; o `new Date()` no
   navegador converte para local. Ao integrar com Google Calendar (futuro),
   pensar em normalizar TZ explicitamente.

3. **Performance em mês com 200+ eventos**: o `detectConflicts()` atual é O(n²).
   Em escala, trocar por algoritmo de varredura (sort + linha do tempo) — O(n
   log n).

4. **Tailwind vs inline styles**: o `page.tsx` mistura os dois. Ao adicionar
   novos componentes (MiniCalendar, FilterPanel), padronizar em Tailwind para
   facilitar manutenção e responsividade mobile.

---

_Documento gerado ao fim da sessão que entregou os 8 quick wins visuais._
_Branch ativa: `main`. Para iniciar a próxima sessão, leia este arquivo
primeiro e continue por onde parou._
