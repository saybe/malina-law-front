/**
 * Фильтрация и поиск по актам. Чистые функции: ни localStorage, ни сети —
 * этот модуль импортируется и страницей, и scripts/check.mjs.
 */

import type { Act, Prefs } from './types.ts'
import { daysAgo } from '../../../shared/lib/date.ts'

/**
 * Акт, сохранённый в избранное. Это снимок из localStorage, а не запись из
 * свежего acts.json, поэтому часть полей может отсутствовать: старый формат
 * хранил один id, а данные могли вытесниться лимитом источника.
 */
export type ActSnapshot = Partial<Act> & Pick<Act, 'id' | 'url'>

const normalize = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')

/** Поиск без учёта регистра, «ё/е», лишних пробелов и тире. */
export function searchText(act: ActSnapshot): string {
  return normalize([act.type, act.number, act.name, act.date].filter(Boolean).join(' '))
}

/** Запрос режется на слова: найти должны все, а не любое из них. */
function queryTokens(query: string | undefined): string[] {
  const needle = normalize(query).trim()
  return needle ? needle.split(/\s+/) : []
}

function matchesTokens(act: ActSnapshot, tokens: string[]): boolean {
  if (!tokens.length) return true
  const haystack = searchText(act)
  return tokens.every((token) => haystack.includes(token.replace(/[«»"']/g, '')))
}

/**
 * Приводит избранное к единому виду: массив снимков актов.
 * Старый формат — просто список id — тоже понимается: акт подтягивается
 * из свежих данных. Снимок, которого в items уже нет, сохраняется как есть:
 * id живёт только внутри acts.json, и без снимка запись было бы не показать.
 */
export function normalizeFavorites(stored: unknown, items: Act[] = []): ActSnapshot[] {
  if (!Array.isArray(stored)) return []

  const byId = new Map(items.map((act) => [act.id, act]))
  const seen = new Set<string>()
  const result: ActSnapshot[] = []

  for (const entry of stored) {
    const id = typeof entry === 'string' ? entry : (entry as { id?: unknown })?.id
    if (typeof id !== 'string' || !id || seen.has(id)) continue

    const fresh = byId.get(id)
    const snapshot: unknown = fresh || entry
    if (typeof snapshot !== 'object' || snapshot === null) continue

    const { url } = snapshot as { url?: unknown }
    if (typeof url !== 'string' || !url) continue

    seen.add(id)
    result.push(snapshot as ActSnapshot)
  }

  return result
}

/**
 * Идентификаторы отмеченных актов.
 *
 * Именно эта функция когда-то была написана как new Set(favorites), то есть
 * множество объектов, а проверка шла по act.id — строкам. Звёздочка в карточке
 * никогда не подсвечивалась. Собирать Set из id здесь, в проверяемом слое,
 * дешевле, чем ловить это в вёрстке.
 */
export function favoriteIds(favorites: ActSnapshot[]): Set<string> {
  return new Set(favorites.map((act) => act.id))
}

/** Возвращает новый список: снять отметку или добавить снимок в начало. */
export function toggleFavorite(favorites: ActSnapshot[], act: ActSnapshot): ActSnapshot[] {
  if (!favorites.some((value) => value.id === act.id)) return [act, ...favorites]
  return favorites.filter((value) => value.id !== act.id)
}

/**
 * Режим «только избранное». Период и уровень намеренно игнорируются:
 * иначе отмеченный акт старше недели прячется — и причина его отмечать исчезает.
 * Поиск, наоборот, остаётся рабочим.
 */
export function selectFavorites(
  favorites: ActSnapshot[],
  prefs: Partial<Prefs> = {},
): ActSnapshot[] {
  const tokens = queryTokens(prefs.query)
  if (!tokens.length) return favorites

  return favorites.filter((act) => matchesTokens(act, tokens))
}

export function selectActs(items: Act[], { range, showOther, query }: Prefs): Act[] {
  // «1» — только сегодня, «3» — сегодня и двое предыдущих, «0» — без ограничения.
  const from = range === '0' ? null : daysAgo(Number(range) - 1)
  const tokens = queryTokens(query)

  return items.filter((act) => {
    if (!showOther && act.level !== 'federal') return false
    if (from && act.date < from) return false
    return matchesTokens(act, tokens)
  })
}
