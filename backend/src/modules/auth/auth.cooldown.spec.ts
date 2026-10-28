import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import * as bcrypt from 'bcryptjs';

describe('SA com credenciais válidas durante cooldown', () => {
  it('exige senha correta e conta SA ativa', async () => {
    const user = { ativo: true, bloqueado: false, senhaHash: await bcrypt.hash('senha-de-teste', 4) };
    const db: any = { user: { findFirst: jest.fn().mockResolvedValue(user) } };
    const config: any = { get: (_: string, fallback: string) => fallback };
    const auth = new AuthService(db, null, config, null, null, null, null);
    expect(await auth.canBypassLoginCooldown('outro@exemplo.com', 'senha-de-teste')).toBe(false);
    expect(db.user.findFirst).not.toHaveBeenCalled();
    expect(await auth.canBypassLoginCooldown('administrator@orkiestri.com', 'errada')).toBe(false);
    expect(await auth.canBypassLoginCooldown('administrator@orkiestri.com', 'senha-de-teste')).toBe(true);
    user.bloqueado = true;
    expect(await auth.canBypassLoginCooldown('administrator@orkiestri.com', 'senha-de-teste')).toBe(false);
  });
  it('não chama login quando a senha do SA não foi validada', async () => {
    const auth: any = { canBypassLoginCooldown: jest.fn().mockResolvedValue(false), login: jest.fn() };
    const cache: any = { rateLimitIncr: jest.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(1), ttl: jest.fn().mockResolvedValue(300) };
    await expect(new AuthController(auth, cache).login({ email: 'administrator@orkiestri.com', senha: 'errada' }, { headers: {}, ip: '127.0.0.1' }, {} as any)).rejects.toThrow('Muitas tentativas');
    expect(auth.login).not.toHaveBeenCalled();
  });
  it('limita verificações extras durante a mesma janela curta', async () => {
    const auth: any = { canBypassLoginCooldown: jest.fn(), login: jest.fn() };
    const cache: any = { rateLimitIncr: jest.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(2), ttl: jest.fn().mockResolvedValue(300) };
    await expect(new AuthController(auth, cache).login({ email: 'administrator@orkiestri.com', senha: 'senha' }, { headers: {}, ip: '127.0.0.1' }, {} as any)).rejects.toThrow('Muitas tentativas');
    expect(auth.canBypassLoginCooldown).not.toHaveBeenCalled();
  });
});
