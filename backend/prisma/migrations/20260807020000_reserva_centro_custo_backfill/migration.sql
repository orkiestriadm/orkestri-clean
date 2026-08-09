-- Preserva o centro de custo da reserva ao unificar os dois desenhos
--
-- Homologação guardava o centro de custo da reserva como CHAVE ESTRANGEIRA
-- (`centro_custo_id`); a branch e produção guardam como TEXTO (`centro_custo`),
-- com o código do centro — ver 20260726200000_veiculo_centro_custo_texto, que
-- fez essa escolha de propósito para corrigir um drift que deixava a Frota
-- inoperante.
--
-- Convergir para o texto sem copiar o dado faria o centro de custo sumir da
-- tela em homologação, mesmo com o valor ainda no banco, na outra coluna.
--
-- No dia em que isto foi escrito, homologação tinha 4 reservas e NENHUMA com o
-- FK preenchido — então na prática o UPDATE não afeta linha nenhuma. Ele existe
-- para o caso de alguma ser preenchida entre agora e o deploy, e para deixar
-- registrado o que aconteceu com aquele dado.
--
-- Seguro em qualquer ambiente: se `centro_custo_id` não existir, o bloco não
-- roda; e só toca em linha cujo texto está vazio.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservas_veiculo' AND column_name = 'centro_custo_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservas_veiculo' AND column_name = 'centro_custo'
  ) THEN
    EXECUTE $sql$
      UPDATE reservas_veiculo r
         SET centro_custo = c.codigo
        FROM centros_custo c
       WHERE r.centro_custo_id = c.id
         AND r.centro_custo IS NULL
    $sql$;
  END IF;
END $$;
