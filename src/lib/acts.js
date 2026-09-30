/**
 * Работа с данными: загрузка, кэш, фильтры, поиск.
 * Знание о формате файла public/data/acts.json описано в README.md.
 */

/**
 * Необязательный внешний источник (см. public/config.js).
 * Если задан jsonUrl, страница сначала пробует его, а потом файл в репозитории.
 * Полезно, если из GitHub Actions не достучаться до .gov.ru: воркер отдаёт
 * тот же самый JSON по HTTPS.
 *
 * Значения читаются лениво, чтобы модуль можно было импортировать в обычном
 * Node — так работает scripts/check.mjs.
 */
const bundledUrl = () => `${import.meta.env.BASE_URL}data/acts.json`
const remoteUrl = () => globalThis.window?.MALINA_CONFIG?.jsonUrl || ''

const CACHE_KEY = 'malina-law:acts'
const FAVORITES_KEY = 'malina-law:favorites'
const PREFS_KEY = 'malina-law:prefs'

/* ------------------------------------------------------------------ */
/* Хранилище                                                            */
/* ------------------------------------------------------------------ */

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* приватный режим или переполнение — работаем без кэша */
  }
}

export const loadFavorites = () => {
  const value = readJson(FAVORITES_KEY, [])
  return Array.isArray(value) ? value : []
}

export const saveFavorites = (acts) => writeJson(FAVORITES_KEY, acts)

export const loadPrefs = () => ({
  range: '7',
  showOther: false,
  query: '',
  onlyFavorites: false,
  ...readJson(PREFS_KEY, {}),
})

export const savePrefs = (prefs) => writeJson(PREFS_KEY, prefs)

/* ------------------------------------------------------------------ */
/* Загрузка                                                             */
/* ------------------------------------------------------------------ */

function readCache() {
  const cached = readJson(CACHE_KEY, null)
  if (!cached?.payload) return null
  return cached
}

async function fetchJson(url) {
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const payload = await response.json()
  if (!payload || !Array.isArray(payload.items)) throw new Error('неожиданный формат файла')

  return payload
}

/**
 * Каждый заход на страницу делает реальный запрос: query с меткой времени
 * и cache: 'no-store' обходят кэш браузера и CDN GitHub Pages.
 */
export async function loadActs() {
  const remote = remoteUrl()
  const sources = remote ? [remote, bundledUrl()] : [bundledUrl()]
  const problems = []

  for (const url of sources) {
    try {
      const payload = await fetchJson(url)
      writeJson(CACHE_KEY, { savedAt: Date.now(), payload })
      return { payload, fromCache: false }
    } catch (error) {
      problems.push(`${url}: ${error.message}`)
    }
  }

  const cached = readCache()
  if (cached) return { payload: cached.payload, fromCache: true, error: new Error(problems.join('; ')) }

  throw new Error(problems.join('; '))
}

/* ------------------------------------------------------------------ */
/* Фильтрация                                                           */
/* ------------------------------------------------------------------ */

export const RANGES = [
  { value: '1', label: 'Сегодня' },
  { value: '3', label: '3 дня' },
  { value: '7', label: 'Неделя' },
  { value: '30', label: 'Месяц' },
  { value: '0', label: 'Всё' },
]

/** Локальная дата в формате YYYY-MM-DD (без сдвига часового пояса). */
function today() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function daysAgo(n) {
  const date = new Date()
  date.setDate(date.getDate() - n)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')

/** Поиск без учёта регистра, «ё/е», лишних пробелов и тире. */
export function searchText(act) {
  return normalize([act.type, act.number, act.name, act.date].filter(Boolean).join(' '))
}

/**
 * Приводит избранное к единому виду: массив снимков актов.
 * Старый формат — просто список id — тоже понимается: акт подтягивается
 * из свежих данных. Снимок, которого в items уже нет, сохраняется как есть:
 * id живёт только внутри acts.json, и без снимка запись была бы не показать.
 */
export function normalizeFavorites(stored, items = []) {
  if (!Array.isArray(stored)) return []

  const byId = new Map(items.map((act) => [act.id, act]))
  const seen = new Set()
  const result = []

  for (const entry of stored) {
    const id = typeof entry === 'string' ? entry : entry?.id
    if (typeof id !== 'string' || !id || seen.has(id)) continue

    const fresh = byId.get(id)
    const snapshot = fresh || entry
    if (typeof snapshot !== 'object' || snapshot === null) continue
    if (typeof snapshot.url !== 'string' || !snapshot.url) continue

    seen.add(id)
    result.push(snapshot)
  }

  return result
}

/**
 * Режим «только избранное». Период и уровень намеренно игнорируются:
 * иначе отмеченный акт старше недели прячется — и причина его отмечать исчезает.
 * Поиск, наоборот, остаётся рабочим.
 */
export function selectFavorites(favorites, { query } = {}) {
  const needle = normalize(query).trim()
  const tokens = needle ? needle.split(/\s+/) : []

  if (!tokens.length) return favorites

  return favorites.filter((act) => {
    const haystack = searchText(act)
    return tokens.every((token) => haystack.includes(token.replace(/[«»"']/g, '')))
  })
}

export function selectActs(items, { range, showOther, query }) {
  // «1» — только сегодня, «3» — сегодня и двое предыдущих, «0» — без ограничения.
  const from = range === '0' ? null : daysAgo(Number(range) - 1)
  const needle = normalize(query).trim()
  const tokens = needle ? needle.split(/\s+/) : []

  return items.filter((act) => {
    if (!showOther && act.level !== 'federal') return false
    if (from && act.date < from) return false
    if (!tokens.length) return true

    const haystack = searchText(act)
    return tokens.every((token) => haystack.includes(token.replace(/[«»"']/g, '')))
  })
}

/* ------------------------------------------------------------------ */
/* Форматирование                                                       */
/* ------------------------------------------------------------------ */

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

export function formatDate(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return `${day} ${MONTHS[month - 1]} ${year}`
}

/** «26.09.2026» — для вёрстки, где длинная дата выталкивает содержимое строки. */
export function formatDateShort(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso

  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(day)}.${pad(month)}.${year}`
}

export function formatUpdatedAt(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** «5 мин назад», «2 ч назад» — для индикатора свежести. */
export function formatAge(iso) {
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

export { today }
