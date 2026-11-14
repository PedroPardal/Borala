import { Category, CategoryId, WeeklySlot } from '../types';
import { t, TKey } from '../i18n';

const make = (id: CategoryId, icon: string, color: string): Category => ({
  id,
  icon,
  color,
  // o nome vem do idioma escolhido na hora de mostrar
  get label() {
    return t(`cat.${id}` as TKey);
  },
});

export const categories: Category[] = [
  make('entregas', 'bicycle', '#FF5722'),
  make('fretes', 'cube', '#2563EB'),
  make('limpeza', 'sparkles', '#0891B2'),
  make('reparos', 'hammer', '#64748B'),
  make('jardinagem', 'leaf', '#16A34A'),
  make('beleza', 'cut', '#DB2777'),
  make('pets', 'paw', '#D97706'),
  make('tecnologia', 'laptop', '#7C3AED'),
  make('aulas', 'school', '#4F46E5'),
];

/** Agenda inicial de um prestador recém-cadastrado: seg a sex, manhã e tarde. */
export const defaultAvailability: WeeklySlot[] = [1, 2, 3, 4, 5].map((day) => ({
  day,
  slots: ['08:00', '09:00', '10:00', '13:00', '14:00', '15:00'],
}));
