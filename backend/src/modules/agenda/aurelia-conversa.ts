export function orientacaoAurelia(agenda = true, gastos = true): string {
  return 'Oiee, eu sou a Aurélia, assistente e assessora do Orkiestri.\n\nDiga o que você quer fazer.' +
    (agenda ? '\n\nPara marcar um compromisso, escreva: “Dentista hoje às 17h”.' : '') +
    (gastos ? '\n\nPara anotar um gasto, escreva: “Almoço 30 reais no Pix”.' : '') +
    '\n\nEu repito os detalhes e pergunto se está tudo certo antes de salvar.' +
    '\n\nPara usar outras funções, abra o Orkiestri no navegador: https://www.orkiestri.com/login';
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
