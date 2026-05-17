"use client";
import { useAuthStore } from "@/lib/store";

/**
 * Retorna true se o usuário tem TODAS as permissões informadas.
 * Masters têm acesso total independente da lista.
 *
 * @example
 * const pode = usePermission("projetos:criar");
 * const podeGerenciar = usePermission("usuarios:editar", "usuarios:permissoes");
 */
export function usePermission(...perms: string[]): boolean {
  const user = useAuthStore(s => s.user);
  if (!user) return false;
  if (user.isMaster) return true;
  if (user.permissions?.includes("*")) return true;
  return perms.every(p => user.permissions?.includes(p));
}

/**
 * Retorna true se o usuário tem ALGUMA das permissões informadas.
 */
export function useAnyPermission(...perms: string[]): boolean {
  const user = useAuthStore(s => s.user);
  if (!user) return false;
  if (user.isMaster) return true;
  if (user.permissions?.includes("*")) return true;
  return perms.some(p => user.permissions?.includes(p));
}
