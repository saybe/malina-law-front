/**
 * Форматирование дат. Чистые функции: ни localStorage, ни fetch, ни import.meta.env —
 * этот модуль импортируется и страницей, и scripts/check.mjs.
 */

const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const pad = (value: number): string => String(value).padStart(2, '0')

/** Разбирает YYYY-MM-DD в тройку чисел. Мусор на входе даёт null. */
function parseIso(iso: string | undefined | null): [number, number, number] | null {
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  return [year, month, day]
}

export function formatDate(iso: string | undefined | null): string {
  const parts = parseIso(iso)
  if (!parts) return iso ?? ''
  const [year, month, day] = parts
  return `${day} ${MONTHS[month - 1]} ${year}`
}

/** «26.09.2026» — для вёрстки, где длинная дата выталкивает содержимое строки. */
export function formatDateShort(iso: string | undefined | null): string {
  const parts = parseIso(iso)
  if (!parts) return iso ?? ''
  const [year, month, day] = parts
  return `${pad(day)}.${pad(month)}.${year}`
}

export function formatUpdatedAt(iso: string | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** «5 мин назад», «2 ч назад» — для индикатора свежести. */
export function formatAge(iso: string | null | undefined): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null

  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ч назад`

  return `${Math.round(hours / 24)} дн назад`
}

/** Локальная дата в YYYY-MM-DD, без сдвига часового пояса. */
export function today(): string {
  return localIso(0)
}

/** Дата, отстоящая от сегодняшней на n дней, тоже в YYYY-MM-DD. */
export function daysAgo(n: number): string {
  return localIso(n)
}

function localIso(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() - offsetDays)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
