"use client";

import { useCallback, useEffect, useState } from "react";
import { positionsService, Cargo, CargoSolto } from "@/lib/people/positions.service";

/**
 * Catálogo de cargos e os textos soltos que ainda não viraram cargo.
 *
 * Os soltos vêm numa chamada separada e sob permissão mais forte
 * (`people.cargo:gerenciar`): quem só consulta o catálogo não precisa ver a
 * bagunça histórica, e receberia 403. Por isso a falha ali é silenciosa e não
 * derruba a tela toda.
 */
export function usePositions(incluirInativos: boolean) {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [soltos, setSoltos] = useState<CargoSolto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setSemPermissao(false);
    try {
      const r = await positionsService.listar(incluirInativos);
      setCargos(r.data ?? []);
    } catch (e: any) {
      setCargos([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar os cargos.");
    } finally {
      setCarregando(false);
    }

    try {
      const r = await positionsService.soltos();
      setSoltos(r.data ?? []);
    } catch {
      setSoltos([]);
    }
  }, [incluirInativos]);

  useEffect(() => { carregar(); }, [carregar]);

  return { cargos, soltos, carregando, erro, semPermissao, recarregar: carregar };
}
