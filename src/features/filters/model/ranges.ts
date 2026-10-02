/** Периоды в панели фильтров. Значение попадает в Prefs.range как строка. */

export const RANGES = [
  { value: '1', label: 'Сегодня' },
  { value: '3', label: '3 дня' },
  { value: '7', label: 'Неделя' },
  { value: '30', label: 'Месяц' },
  { value: '0', label: 'Всё' },
] as const
