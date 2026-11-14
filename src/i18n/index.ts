import pt from './pt';
import en from './en';
import es from './es';

export type Lang = 'pt' | 'en' | 'es';
export type TKey = keyof typeof pt;
export type Dictionary = Record<TKey, string>;

/** Idiomas do app, com o nome escrito no próprio idioma. */
export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
];

const dicts: Record<Lang, Dictionary> = { pt, en, es };
const LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

/** Idioma do celular, se for um dos três; senão português. */
export function detectLang(): Lang {
  try {
    const code = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase();
    return code === 'en' || code === 'es' ? code : 'pt';
  } catch {
    return 'pt';
  }
}

let lang: Lang = detectLang();

/** Troca o idioma; o SettingsProvider remonta as telas para elas lerem os textos novos. */
export function setLang(next: Lang) {
  lang = next;
}

export const getLang = () => lang;

/** Código de localidade para datas e moeda (ex.: "pt-BR"). */
export const localeTag = () => LOCALES[lang];

/** Texto traduzido. `{nome}` no texto é trocado por `params.nome`. */
export function t(key: TKey, params?: Record<string, string | number>): string {
  const s = dicts[lang][key] ?? pt[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Lista guardada no dicionário separada por "|" (ex.: dias da semana). */
export const tList = (key: TKey) => t(key).split('|');
