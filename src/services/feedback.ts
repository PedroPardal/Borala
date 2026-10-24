import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/**
 * Feedback "estilo Duolingo": cada interação importante combina
 * um som curto e satisfatório + vibração háptica leve.
 * Os players são pré-carregados uma única vez para tocar sem atraso.
 */
const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  select: require('../../assets/sounds/select.wav'),
  success: require('../../assets/sounds/success.wav'),
  error: require('../../assets/sounds/error.wav'),
  celebrate: require('../../assets/sounds/celebrate.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  message: require('../../assets/sounds/message.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const VOLUME: Record<SoundName, number> = {
  tap: 0.5,
  select: 0.6,
  success: 0.8,
  error: 0.7,
  celebrate: 0.9,
  whoosh: 0.35,
  message: 0.6,
};

let players: Partial<Record<SoundName, AudioPlayer>> = {};
let enabled = true;
let lastWhoosh = 0;

export const Sound = {
  async init() {
    try {
      // mixWithOthers: os efeitos não pausam a música que o usuário estiver ouvindo
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
      (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
        const p = createAudioPlayer(SOURCES[name]);
        p.volume = VOLUME[name];
        players[name] = p;
      });
    } catch (e) {
      console.warn('[Sound] falha ao inicializar', e);
    }
  },

  play(name: SoundName) {
    if (!enabled) return;
    // evita "whoosh" duplicado quando várias telas mudam no mesmo instante
    if (name === 'whoosh') {
      const now = Date.now();
      if (now - lastWhoosh < 250) return;
      lastWhoosh = now;
    }
    const p = players[name];
    if (!p) return;
    try {
      // volta ao início para permitir toques repetidos em sequência
      Promise.resolve(p.seekTo(0)).catch(() => {});
      p.play();
    } catch {
      // som é "best effort": nunca deve quebrar a UI
    }
  },

  setEnabled(value: boolean) {
    enabled = value;
  },

  isEnabled() {
    return enabled;
  },

  release() {
    Object.values(players).forEach((p) => p?.remove());
    players = {};
  },
};

/** Atalhos que combinam som + háptico */
export const feedback = {
  tap() {
    Sound.play('tap');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  select() {
    Sound.play('select');
    Haptics.selectionAsync().catch(() => {});
  },
  success() {
    Sound.play('success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error() {
    Sound.play('error');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  celebrate() {
    Sound.play('celebrate');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  message() {
    Sound.play('message');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  },
  transition() {
    Sound.play('whoosh');
  },
};
