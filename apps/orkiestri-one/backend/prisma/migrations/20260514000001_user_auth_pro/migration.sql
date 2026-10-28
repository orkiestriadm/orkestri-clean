-- User: new auth fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS primeiro_acesso BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tentativas_falhas INTEGER NOT NULL DEFAULT 0;

-- User requests (solicitações de criação de conta)
CREATE TABLE IF NOT EXISTS user_requests (
  id TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  cargo TEXT,
  departamento TEXT,
  empresa TEXT,
  motivacao TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  approved_by_id TEXT,
  approved_at TIMESTAMP(3),
  rejection_reason TEXT,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_requests_pkey PRIMARY KEY (id)
);

-- OTP para recuperação de senha via WhatsApp
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  otp_expires_at TIMESTAMP(3) NOT NULL,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_reset_otps_pkey PRIMARY KEY (id),
  CONSTRAINT password_reset_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
