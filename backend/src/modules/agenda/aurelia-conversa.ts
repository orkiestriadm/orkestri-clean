export function orientacaoAurelia(agenda = true, gastos = true): string {
  return 'Oi! Sou a Aurélia. Me conte o que você precisa organizar.' +
    (agenda ? '\n\nPara marcar um compromisso, pode escrever: “Dentista hoje às 17h” ou “Aurélia, anota aí pra mim: academia amanhã às 15”. Eu confiro os detalhes com você antes de salvar.' : '') +
    (gastos ? '\n\nPara anotar um gasto: “lançar barrinha de cereal 12 reais no pix” ou “lançar Gasolina 400 reais no crédito em 3x”. No parcelado, distribuo o total entre o mês da compra e os seguintes, depois da sua confirmação.' : '') +
    '\n\nPara os outros módulos e uma visão completa da sua rotina, abra https://www.orkiestri.com/login. No navegador você tem mais espaço para visualizar e organizar tudo.';
}

/** Values are divided in cents; each monthly row is counted once by existing reports. */
export function parcelasMensais(valor: number, quantidade: number, dia: string) {
  const centavos = Math.round(valor * 100);
  if (!Number.isSafeInteger(centavos) || centavos < 1 || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 120 || centavos < quantidade)
    throw new Error('Informe um valor e uma quantidade de parcelas válidos.');
  const data = new Date(dia + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !Number.isFinite(data.getTime()) || data.toISOString().slice(0,10) !== dia) throw new Error('Data inválida.');
  return Array.from({length:quantidade}, (_,i) => {
    const primeiro = new Date(Date.UTC(data.getUTCFullYear(),data.getUTCMonth()+i,1,12));
    const ultimo = new Date(Date.UTC(primeiro.getUTCFullYear(),primeiro.getUTCMonth()+1,0)).getUTCDate();
    primeiro.setUTCDate(Math.min(data.getUTCDate(),ultimo));
    return {valor:(Math.floor(centavos/quantidade)+(i<centavos%quantidade?1:0))/100,dataGasto:primeiro};
  });
}
