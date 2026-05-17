// Gera sons via Web Audio API - sem arquivos externos

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}

function beep(freq: number, duration: number, volume: number, type: OscillatorType = "sine"): Promise<void> {
  return new Promise(resolve => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
      setTimeout(resolve, duration * 1000 + 50);
    } catch { resolve(); }
  });
}

async function pause(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export const sounds = {
  // 60min - 1 bip suave
  reminder60: async (volume = 0.3) => {
    await beep(440, 0.3, volume, "sine");
  },

  // 15min - 2 bips medios
  reminder15: async (volume = 0.5) => {
    await beep(523, 0.25, volume, "sine");
    await pause(150);
    await beep(659, 0.25, volume, "sine");
  },

  // 5min - 3 bips urgentes
  reminder5: async (volume = 0.7) => {
    for (let i = 0; i < 3; i++) {
      await beep(880, 0.15, volume, "square");
      await pause(100);
    }
  },

  // Na hora - sirene
  now: async (volume = 0.8) => {
    for (let i = 0; i < 4; i++) {
      await beep(1047, 0.12, volume, "sawtooth");
      await pause(80);
      await beep(831, 0.12, volume, "sawtooth");
      await pause(80);
    }
  },

  // Notificacao generica
  notification: async (volume = 0.4) => {
    await beep(698, 0.15, volume, "sine");
    await pause(80);
    await beep(880, 0.2, volume, "sine");
  },

  // Teste
  test: async (volume = 0.5) => {
    await beep(523, 0.2, volume);
    await pause(100);
    await beep(659, 0.2, volume);
    await pause(100);
    await beep(784, 0.3, volume);
  },
};

export function playAlertSound(minutosRestantes: number, volume = 0.5) {
  try {
    if (minutosRestantes <= 0) sounds.now(volume);
    else if (minutosRestantes <= 5) sounds.reminder5(volume);
    else if (minutosRestantes <= 15) sounds.reminder15(volume);
    else sounds.reminder60(volume);
  } catch {}
}