-- Condição do veículo relatada na abertura do chamado.
--
-- "inoperante" ou "operando_com_avaria". É RELATO de quem abriu, não estado do
-- veículo: o farol em Frotas continua vindo do módulo de Frotas. A separação é
-- deliberada — se este campo alimentasse o farol, um chamado mal preenchido
-- mudaria a operação da frota.
--
-- Idempotente: os três ambientes têm histórico de migration divergente, e uma
-- migration que assume estado limpo já derrubou a API de homologação por 8 min.
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "condicao_veiculo" TEXT;
