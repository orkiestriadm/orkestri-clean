'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  ShieldCheck, Database, Lock, Users, ScrollText,
  ClipboardList, Activity, Building2, CheckCircle2, Sparkles,
} from 'lucide-react'

const PILLARS = [
  {
    icon: ShieldCheck,
    color: '#34d399',
    accent: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.22)',
    label: 'LGPD Compliance',
    titulo: 'Conformidade total com a LGPD',
    descricao:
      'Tratamento de dados pessoais em conformidade com a Lei Geral de Proteção de Dados. Consentimento rastreável, direito ao esquecimento e DPO-ready por arquitetura.',
    bullets: ['Coleta mínima de dados', 'Portabilidade e exclusão sob demanda', 'Política de retenção configurável'],
    badge: 'Lei 13.709/2018',
  },
  {
    icon: Lock,
    color: '#a78bfa',
    accent: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.22)',
    label: 'Criptografia',
    titulo: 'Dados protegidos em trânsito e em repouso',
    descricao:
      'TLS 1.3 obrigatório em todas as comunicações. Senhas com bcrypt e salt único. Tokens JWT com rotação automática e cookies HttpOnly — sem exposição de credenciais.',
    bullets: ['TLS 1.3 end-to-end', 'bcrypt com salt por usuário', 'JWT HttpOnly · Refresh token rotation'],
    badge: 'TLS 1.3 · AES-256',
  },
  {
    icon: Users,
    color: '#22d3ee',
    accent: 'rgba(34,211,238,0.12)',
    border: 'rgba(34,211,238,0.22)',
    label: 'RBAC',
    titulo: 'Controle de acesso granular por perfil',
    descricao:
      'Role-Based Access Control com permissões por módulo, ação e recurso. Sobrescritas individuais por usuário permitem ajustes pontuais sem criar novos papéis.',
    bullets: ['Perfis configuráveis por organização', 'Permissões por módulo + ação + recurso', 'Override individual por usuário'],
    badge: 'Zero Trust · Least Privilege',
  },
  {
    icon: Building2,
    color: '#fbbf24',
    accent: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.22)',
    label: 'Multi-Tenant',
    titulo: 'Isolamento total entre organizações',
    descricao:
      'Cada tenant opera em namespace completamente isolado. Dados, usuários e configurações de uma organização jamais são acessíveis por outra — garantido em nível de banco de dados.',
    bullets: ['Isolamento por organization_id em cada query', 'Impossível vazamento cross-tenant por design', 'White-label nativo por organização'],
    badge: 'Database-level isolation',
  },
  {
    icon: ClipboardList,
    color: '#f472b6',
    accent: 'rgba(244,114,182,0.12)',
    border: 'rgba(244,114,182,0.22)',
    label: 'Auditoria',
    titulo: 'Trilha de auditoria imutável',
    descricao:
      'Cada ação crítica gera um log de auditoria permanente: quem fez, o quê, quando e de qual IP. Ideal para auditorias internas, revisões de acesso e compliance regulatório.',
    bullets: ['Log de todas as ações sensíveis', 'IP, timestamp e usuário registrados', 'Exportação para auditores externos'],
    badge: 'Audit Trail · SOX-ready',
  },
  {
    icon: ScrollText,
    color: '#fb923c',
    accent: 'rgba(251,146,60,0.12)',
    border: 'rgba(251,146,60,0.22)',
    label: 'Logs Operacionais',
    titulo: 'Visibilidade total das operações',
    descricao:
      'Logs estruturados de eventos do sistema, erros, integrações e chamadas de API. Rastreamento completo para diagnóstico, debugging e gestão de incidentes com histórico permanente.',
    bullets: ['Logs de eventos e erros em tempo real', 'Histórico de integrações e webhooks', 'Acesso via painel SA com filtros avançados'],
    badge: 'Structured Logging',
  },
  {
    icon: Database,
    color: '#34d399',
    accent: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.22)',
    label: 'Backup & Recuperação',
    titulo: 'Seus dados nunca estão em risco',
    descricao:
      'Backups automatizados diários com retenção configurável. Infraestrutura em nuvem com redundância geográfica e plano de recuperação de desastres testado regularmente.',
    bullets: ['Backup diário automatizado', 'Retenção configurável por período', 'Restore testado e documentado'],
    badge: 'RPO < 24h · RTO < 4h',
  },
  {
    icon: Activity,
    color: '#a78bfa',
    accent: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.22)',
    label: 'Alta Disponibilidade',
    titulo: '99,9% de uptime garantido em SLA',
    descricao:
      'Infraestrutura cloud com auto-scaling, health checks contínuos e zero-downtime deployments. Monitoramento 24/7 com alertas proativos antes que qualquer falha impacte sua operação.',
    bullets: ['99,9% SLA com garantia contratual', 'Auto-scaling em picos de demanda', 'Monitoramento proativo 24/7'],
    badge: '99,9% SLA · Zero-downtime',
  },
]

const CERTIFICATIONS = [
  { label: 'LGPD', desc: 'Lei 13.709/2018' },
  { label: 'OWASP', desc: 'Top 10 Compliance' },
  { label: 'TLS 1.3', desc: 'Trânsito criptografado' },
  { label: 'JWT', desc: 'HttpOnly · Refresh rotation' },
  { label: 'RBAC', desc: 'Zero Trust' },
  { label: '99,9%', desc: 'Uptime SLA' },
]

export default function SecuritySection() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-6%' })

  return (
    <section ref={ref} className="relative py-12 lg:py-16 overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(52,211,153,0.2)] to-transparent" />
        <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-emerald-500/6 blur-[140px] rounded-full" />
        <div className="absolute bottom-1/3 right-0 w-[500px] h-[500px] bg-violet-600/8 blur-[120px] rounded-full" />
        <div className="absolute top-2/3 left-1/2 w-[400px] h-[400px] bg-cyan-500/6 blur-[100px] rounded-full -translate-x-1/2" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.07)] text-[#34d399] text-xs font-medium mb-5">
            <ShieldCheck size={12} /> Segurança & Governança
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] mb-5 leading-[1.1]">
            Segurança enterprise.{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Sem abrir mão da agilidade.
            </span>
          </h2>
          <p className="text-[var(--text-secondary)] text-lg leading-relaxed max-w-2xl mx-auto">
            Construído com segurança e conformidade como pilares de arquitetura — não como camadas adicionadas depois. Do banco de dados à interface, cada decisão protege seus dados e sua operação.
          </p>
        </motion.div>

        {/* Certification strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-wrap items-center justify-center gap-3 mb-12"
        >
          {CERTIFICATIONS.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.2 + i * 0.07, duration: 0.4 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] backdrop-blur-sm"
            >
              <CheckCircle2 size={12} className="text-[#34d399] shrink-0" />
              <span className="text-[var(--text-primary)] text-xs font-semibold">{c.label}</span>
              <span className="text-[var(--text-muted)] text-[10px]">· {c.desc}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Pillar grid — 4 cols × 2 rows */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PILLARS.map((p, i) => {
            const Icon = p.icon
            return (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.25 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="group lp-card rounded-2xl border p-5 flex flex-col gap-3 hover:shadow-[0_0_32px_rgba(52,211,153,0.07)] transition-all duration-300 hover:-translate-y-0.5"
                style={{ borderColor: 'rgba(255,255,255,0.07)' }}
              >
                {/* Icon + badge row */}
                <div className="flex items-start justify-between">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    style={{ background: p.accent, border: `1px solid ${p.border}` }}
                  >
                    <Icon size={16} style={{ color: p.color }} />
                  </div>
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full border"
                    style={{ color: p.color, borderColor: p.border, background: p.accent }}
                  >
                    {p.badge}
                  </span>
                </div>

                {/* Text */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: p.color }}>
                    {p.label}
                  </div>
                  <h3 className="text-[var(--text-primary)] font-semibold text-sm leading-snug mb-2">
                    {p.titulo}
                  </h3>
                  <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                    {p.descricao}
                  </p>
                </div>

                {/* Bullets */}
                <div className="flex flex-col gap-1.5 mt-auto pt-2 border-t border-[rgba(255,255,255,0.05)]">
                  {p.bullets.map(b => (
                    <div key={b} className="flex items-start gap-1.5">
                      <div
                        className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                        style={{ background: p.color }}
                      />
                      <span className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{b}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Bottom trust banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 relative rounded-2xl overflow-hidden border border-[rgba(52,211,153,0.15)] bg-gradient-to-r from-[rgba(52,211,153,0.04)] via-[rgba(167,139,250,0.04)] to-[rgba(34,211,238,0.04)] px-8 py-6"
        >
          {/* Subtle grid overlay */}
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(52,211,153,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.2)] flex items-center justify-center shrink-0">
                <ShieldCheck size={22} className="text-[#34d399]" />
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-bold text-base">
                  Segurança que não exige configuração extra
                </p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5 max-w-lg">
                  Todos os 8 pilares de segurança são ativos por padrão em toda organização. Nenhuma configuração adicional necessária — proteção enterprise desde o primeiro login.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              {[
                { icon: '🔒', text: 'Zero config security' },
                { icon: '🛡️', text: 'OWASP Top 10' },
                { icon: '📋', text: 'LGPD nativo' },
              ].map(t => (
                <div key={t.text} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)]">
                  <span className="text-sm">{t.icon}</span>
                  <span className="text-[11px] text-[var(--text-secondary)] font-medium">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
