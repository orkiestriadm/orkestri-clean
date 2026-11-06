import { anonimizarExemploAurelia } from './aurelia-privacidade';

describe('privacidade dos exemplos da Aurélia', () => {
  it('remove identificadores pessoais', () => {
    expect(anonimizarExemploAurelia('CPF 35603230886, e-mail guilumagaro@gmail.com, telefone 14981066164'))
      .toBe('CPF [CPF], e-mail [EMAIL], telefone [TELEFONE]');
  });

  it('remove valores financeiros', () => {
    expect(anonimizarExemploAurelia('Almoço R$ 1.500,00 no crédito em 3x')).toBe('Almoço [VALOR] no crédito em 3x');
  });
});
