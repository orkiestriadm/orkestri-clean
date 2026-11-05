/**
 * Versão do site institucional (orkiestri.com).
 *
 * Separada da versão da plataforma (`frontend/src/lib/version.ts`, hoje em 5.x):
 * o site tem ciclo próprio e pode subir várias vezes sem tocar na API ou no
 * painel. Aparece discreta no rodapé para conferência de deploy — bateu o olho
 * no número, sabe se o container novo entrou.
 *
 * Convenção SemVer:
 *   MAJOR — redesign estrutural
 *   MINOR — página/seção nova ou mudança grande de posicionamento
 *   PATCH — ajuste de texto, estilo ou correção
 */
export const VERSAO_SITE = "3.17.0";
export const VERSAO_SITE_DATA = "2026-11-05";
