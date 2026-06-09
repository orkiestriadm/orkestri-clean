# Agenda — Melhorias visuais pendentes

> Continuação do trabalho de polimento visual da agenda.
>
> **Arquivo principal:** `frontend/src/app/dashboard/agenda/page.tsx`
> **Componentes auxiliares:** `frontend/src/components/agenda/`
> **Backend correlato:** `backend/src/modules/agenda/agenda.module.ts`

---

## ✅ Já entregue (referência)

| # | Item | Onde está |
|---|---|---|
| 1 | Diferenciar feriado vs FDS vs hoje | `dayVisual()` |
| 2 | Linha horizontal "agora" | `<NowLine>` + hook `useNow()` |
| 3 | Popover "+N eventos" no Mês | `<MoreEventsPopover>` |
| 4+13 | **Altura proporcional + overlap lado a lado** | `<DayTimeline>` + `<TimedEventBlock>` + `layoutEvents()` |
| 5 | Paleta semântica + cor custom | `TIPO_META` + `<input type="color">` |
| 6 | Ícones por tipo de evento | `tipoMeta(t).icon` |
| 8 | Skeleton de loading | `<CalendarSkeleton>` |
| 9 | Empty state | `<EmptyState>` |
| 10 | Indicador de conflito | `detectConflicts()` + borda vermelha |
| 11 | Mini-calendário lateral + lista próximos eventos | `<MiniCalendar>`, `<UpcomingEventsList>` |
| 14 | Atalhos de teclado | `useEffect(keydown)` + `<ShortcutsHelp>` |
| 16 | Print-friendly view | `@media print`, `.no-print`, `.print-only` |
| + | Acessibilidade básica | `aria-label`, `role="dialog"`, `role="tablist"`, foco visível |
| + | UX de criar evento no dia | botão `+` no hover, duplo clique, segundo toque mobile |

---

## 🟢 Item #12 — Drag & drop de eventos

**Por quê:** maior "uau" pro usuário final. Padrão Google Calendar: arrasta o
evento para outra hora/dia, solta, salva.

**Esforço:** 1-2 dias.

**Stack recomendada:** `@dnd-kit/core` (moderno, leve, acessível).

```bash
npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Implementação:**

1. **Wrap das views em `<DndContext>`:**
```tsx
<DndContext
  modifiers={[restrictToParentElement]}
  onDragEnd={handleDragEnd}
>
  <WeekView ... />
</DndContext>
```

2. **`<TimedEventBlock>` vira `useDraggable`:**
```tsx
const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
  id: event.id,
  data: { type: "event", event },
});
const style = {
  transform: CSS.Translate.toString(transform),
  opacity: isDragging ? 0.5 : 1,
};
return (
  <div ref={setNodeRef} {...listeners} {...attributes} style={{ ...existingStyle, ...style }}>
    ...
  </div>
);
```

3. **Cada slot horário da `<DayTimeline>` vira `useDroppable`:**
```tsx
const { setNodeRef, isOver } = useDroppable({
  id: `slot:${date.toISOString()}:${hour}`,
});
<div ref={setNodeRef} style={{ background: isOver ? "var(--accent-violet-dim)" : ... }}>
```

4. **Handler `handleDragEnd`:**
```tsx
async function handleDragEnd(e: DragEndEvent) {
  if (!e.over) return;
  const eventId = e.active.id as string;
  const droppedSlot = e.over.id as string;          // "slot:YYYY-MM-DDTHH:00:00:HH"
  const newStart = parseSlotId(droppedSlot);
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;

  // Mantém duração original
  const oldDuration = ev.fim
    ? new Date(ev.fim).getTime() - new Date(ev.inicio).getTime()
    : 60 * 60 * 1000;
  const newEnd = new Date(newStart.getTime() + oldDuration);

  // Otimista: atualiza UI primeiro
  setEvents(es => es.map(e => e.id === eventId
    ? { ...e, inicio: newStart.toISOString(), fim: newEnd.toISOString() }
    : e
  ));

  try {
    await api.patch(`/agenda/${eventId}/move`, {
      novoInicio: newStart.toISOString(),
    });
  } catch {
    load(); // reverte do servidor
  }
}
```

5. **Backend novo endpoint** em `backend/src/modules/agenda/agenda.module.ts`:
```ts
@Patch(":id/move")
@Permissions("agenda:editar")
async move(@Param("id") id: string, @Body() body: { novoInicio: string }, @Req() req: any) {
  const evt = await this.prisma.event.findUnique({ where: { id } });
  if (!evt) throw new NotFoundException();
  // Validação: só criador ou master pode mover
  if (evt.criadoPorId !== req.user.id && !req.user.isMaster) {
    throw new ForbiddenException("Apenas o criador pode mover este evento");
  }
  const novoInicio = new Date(body.novoInicio);
  const dur = evt.fim ? evt.fim.getTime() - evt.inicio.getTime() : 60 * 60 * 1000;
  const novoFim = new Date(novoInicio.getTime() + dur);
  return this.prisma.event.update({
    where: { id },
    data: { inicio: novoInicio, fim: novoFim },
  });
}
```

**Gotcha — Recorrência:** se o evento tem `recurringParentId`, abrir prompt:
"Mover só esta ocorrência, ou toda a série?". O backend pode receber um flag
`scope: "single" | "series"` e tratar de acordo.

**Testes manuais:**
- Arrastar evento das 9h para 14h → backend recebe novoInicio, UI atualiza
- Arrastar evento entre dias (Quarta → Sexta) → mesma coisa, ajusta date
- Recorrência: ao arrastar uma ocorrência, modal pergunta antes de salvar
- Falha no backend: UI reverte ao estado original

**Bônus opcional — Resize (estender duração):**
Não tem em `@dnd-kit` pronto, mas dá pra fazer adicionando uma divisória
clicável na borda inferior do `<TimedEventBlock>` com `onMouseDown` + listener
global de `mousemove` calculando nova altura → novo `fim`.

---

## 🟢 Item #15 — Múltiplos calendários sobrepostos com filtros

**Por quê:** equipe quer ver "Meus eventos · Feriados · Equipe X · Projeto Y"
selecionando o que aparece.

**Esforço:** 1-2 dias.

⚠️ **Atenção:** este item exige **migration Prisma em produção**. Reservar
janela dedicada e fazer durante baixo tráfego. Backup antes (já temos cron OK).

**Modelo de dados (`backend/prisma/schema.prisma`):**

```prisma
model Calendar {
  id             String  @id @default(uuid())
  organizationId String  @map("organization_id")
  nome           String
  cor            String  @default("#a78bfa")
  criadoPorId    String  @map("criado_por_id")
  visibilidade   String  @default("pessoal")   // pessoal | equipe | publico
  criadoEm       DateTime @default(now()) @map("criado_em")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  criadoPor    User         @relation(fields: [criadoPorId],   references: [id], onDelete: Cascade)
  events       Event[]

  @@index([organizationId])
  @@map("calendars")
}

model Event {
  // ... campos existentes
  calendarId String?  @map("calendar_id")
  calendar   Calendar? @relation(fields: [calendarId], references: [id], onDelete: SetNull)
}
```

**Migration**:
```bash
npx prisma migrate dev --name add_calendar
```

Após o `migrate dev` local, em prod o cron já roda `prisma migrate deploy` no
startup do API (veja Dockerfile linha final). Backup automático antes!

**Frontend — sidebar com filtro** (`frontend/src/components/agenda/CalendarFilter.tsx`):

```tsx
type Props = {
  calendars: Calendar[];
  active: Set<string>;
  onToggle: (id: string) => void;
};

export default function CalendarFilter({ calendars, active, onToggle }: Props) {
  return (
    <div>
      <h3>Meus calendários</h3>
      {calendars.map(cal => (
        <label key={cal.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox"
            checked={active.has(cal.id)}
            onChange={() => onToggle(cal.id)}
            style={{ accentColor: cal.cor }}
          />
          <span style={{ width: 10, height: 10, borderRadius: 2, background: cal.cor }} />
          <span>{cal.nome}</span>
        </label>
      ))}
    </div>
  );
}
```

**Filtragem nos events**:
```ts
const visibleEvents = events.filter(e =>
  active.has(e.calendarId || "personal")
);
```

**Calendários default que devem ser criados ao seed:**
- `Pessoal` (cor violeta) — visibilidade=pessoal
- `Equipe` (cor cyan) — visibilidade=equipe
- `Feriados` (cor vermelha) — visibilidade=publico, sem persistência (gerado)
- `Projetos` (cor verde) — visibilidade=publico, eventos com `origemTipo=projeto`

**Cor do evento**: se evento tem `calendarId`, usar `calendar.cor` em vez de `evento.cor`.
Manter o `evento.cor` como override opcional.

---

## 🟢 Acessibilidade — itens não-críticos pendentes

- `<time dateTime={iso}>` em vez de `<div>` para datas/horários (semântica)
- Auditoria com `npx pa11y http://localhost:3000/dashboard/agenda` e ajustar
  contraste de cinza claro sobre branco
- Anunciar mudança de período aos leitores de tela ao clicar prev/next via
  `aria-live="polite"` em um sr-only element

**Esforço:** 2h.

---

## 🚀 Sequência sugerida para a próxima sessão

| Ordem | Item | Esforço | Risco |
|---|---|---|---|
| 1 | #12 — Drag & drop (frontend + endpoint backend novo) | 1-2 dias | Médio (lógica de recorrência) |
| 2 | #15 — Múltiplos calendários | 1-2 dias | **Alto (migration em prod)** — fazer com backup recente |
| 3 | Polimento de acessibilidade | 2h | Baixo |

**Recomendação:** começar pelo #12. Ele é puro feature, sem risco de banco.
O #15 deixa pra uma janela com backup recente confirmado.

---

## 📚 Referências

- **Algoritmo de overlap usado em `layoutEvents()`:** [Stack Overflow — Calendar event positioning](https://stackoverflow.com/questions/11311410/visualization-of-calendar-events-algorithm-to-layout-events-with-maximum-width)
- **@dnd-kit docs:** https://docs.dndkit.com
- **FullCalendar** (alternativa drop-in se quiser substituir tudo): https://fullcalendar.io/docs/react
- **Cal.com source** (open source, ótimo de referência): https://github.com/calcom/cal.com

---

## ⚠️ Gotchas conhecidos

1. **Recorrência + drag**: ao arrastar evento recorrente, perguntar "mover só
   esta ocorrência, ou toda a série?". Backend já tem `recurringParentId`.

2. **Fuso horário**: eventos hoje são salvos como string ISO; `new Date()` no
   navegador converte para local. Ao integrar com Google Calendar (futuro),
   normalizar TZ explicitamente.

3. **Performance em mês com 200+ eventos**: `detectConflicts()` é O(n²).
   Em escala, trocar por algoritmo de varredura (sort + linha do tempo) →
   O(n log n).

4. **Migration em produção** (item #15): rodar primeiro em ambiente staging,
   confirmar backup recente em `backups/db/`, **e só então fazer pull**. O
   Dockerfile faz `npx prisma migrate deploy` no entrypoint — uma migration
   incompatível trava o boot do API.

---

_Última atualização: depois da entrega de #4+#13 (altura proporcional + overlap)._
_Para iniciar a próxima sessão, leia este arquivo primeiro e continue por #12._
