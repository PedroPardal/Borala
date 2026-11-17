import { localeTag, t, tList } from '../i18n';

/** Valores em reais (o app atende no Brasil), com o formato do idioma escolhido. */
export const formatBRL = (value: number) => value.toLocaleString(localeTag(), { style: 'currency', currency: 'BRL' });

export const toISODate = (d: Date) => {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const parseISODate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const weekdayShort = (d: Date) => tList('date.weekdays')[d.getDay()];

const monthShort = (d: Date) => tList('date.months')[d.getMonth()];

/** "Seg, 3 de jan" / "Mon, Jan 3" / "Lun, 3 de ene" */
export const formatDateLong = (iso: string) => {
  const d = parseISODate(iso);
  return t('date.long', { wd: weekdayShort(d), d: d.getDate(), m: monthShort(d) });
};

/** "Seg, 3 de jan às 09:00" */
export const formatDateAt = (iso: string, time: string) => t('date.at', { date: formatDateLong(iso), time });

/** Data numérica curta no formato do idioma (ex.: 03/01/2026). */
export const formatDateNumeric = (d: Date) => d.toLocaleDateString(localeTag());

export const nextDays = (count: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
};

const hhmm = (d: Date) => `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;

/** Hora da mensagem: "14:32" se for de hoje, "12 out" se for de outro dia. */
export const formatChatTime = (ms: number) => {
  const d = new Date(ms);
  return toISODate(d) === toISODate(new Date()) ? hhmm(d) : t('date.short', { d: d.getDate(), m: monthShort(d) });
};

export const formatTime = (ms: number) => hhmm(new Date(ms));
