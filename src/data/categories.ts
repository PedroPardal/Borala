import { Category, WeeklySlot } from '../types';

export const categories: Category[] = [
  { id: 'entregas', label: 'Motoboy e Entregas', icon: 'bicycle', color: '#FF5722' },
  { id: 'fretes', label: 'Fretes e Mudanças', icon: 'cube', color: '#2563EB' },
  { id: 'limpeza', label: 'Limpeza', icon: 'sparkles', color: '#0891B2' },
  { id: 'reparos', label: 'Reparos', icon: 'hammer', color: '#0F172A' },
  { id: 'jardinagem', label: 'Jardinagem', icon: 'leaf', color: '#16A34A' },
  { id: 'beleza', label: 'Beleza', icon: 'cut', color: '#DB2777' },
  { id: 'pets', label: 'Pets', icon: 'paw', color: '#D97706' },
  { id: 'tecnologia', label: 'Tecnologia', icon: 'laptop', color: '#7C3AED' },
  { id: 'aulas', label: 'Aulas', icon: 'school', color: '#4F46E5' },
];

/** Agenda inicial de um prestador recém-cadastrado: seg a sex, manhã e tarde. */
export const defaultAvailability: WeeklySlot[] = [1, 2, 3, 4, 5].map((day) => ({
  day,
  slots: ['08:00', '09:00', '10:00', '13:00', '14:00', '15:00'],
}));
