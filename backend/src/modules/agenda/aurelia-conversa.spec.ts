import { orientacaoAurelia, parcelasMensais } from './aurelia-conversa';
describe('Conversa e parcelas mensais',()=>{
  it('orienta agenda e financeiro sem menus numéricos',()=>{
    const t=orientacaoAurelia();
    expect(t).toContain('Dentista hoje às 17h');
    expect(t).toContain('Almoço 30 reais no Pix');
    expect(t).toContain('Me lembre de beber água daqui 15m');
    expect(t).toContain('Faça check-in no hábito Academia');
    expect(t).not.toMatch(/responda.*número|\*[0-9]\*|digite [0-9]/i);
    expect(orientacaoAurelia(false,false)).not.toContain('lançar');
  });
  it('distribui centavos e ajusta fim de mês sem saltar fevereiro',()=>{
    const p=parcelasMensais(400,3,'2027-01-31');
    expect(p.map(x=>x.valor)).toEqual([133.34,133.33,133.33]);
    expect(p.map(x=>x.dataGasto.toISOString().slice(0,10))).toEqual(['2027-01-31','2027-02-28','2027-03-31']);
    expect(p.reduce((s,x)=>s+Math.round(x.valor*100),0)).toBe(40000);
  });
  it('valida limites e ano bissexto',()=>{
    expect(parcelasMensais(12,3,'2027-12-31')[2].dataGasto.toISOString().slice(0,10)).toBe('2028-02-29');
    for(const [v,n] of [[0,1],[400,121],[0.01,3],[1,1.5]]) expect(()=>parcelasMensais(v,n,'2027-01-31')).toThrow();
    expect(()=>parcelasMensais(100,2,'2027-02-31')).toThrow();
  });
});
