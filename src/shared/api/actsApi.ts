/**
 * Загрузка данных: внешний источник, затем файл в репозитории, затем кэш.
 * Модуль браузерный — здесь fetch, import.meta.env и localStorage,
 * поэтому его нельзя импортировать из scripts/check.mjs.
 *
 * Знание о формате файла public/data/acts.json описано в README.md.
 */

import type { ActPayload } from '../../entities/act/model/types.ts'
import { readJson, writeJson } from '../lib/storage.ts'

const CACHE_KEY = 'malina-law:acts'

/**
 * Необязательный внешний источник (см. public/config.js).
 * Если задан jsonUrl, страница сначала пробует его, а потом файл в репозитории.
 * Полезно, если из GitHub Actions не достучаться до .gov.ru: воркер отдаёт
 * тот же самый JSON по HTTPS.
 *
 * Значения читаются лениво, чтобы модуль можно было импортировать в обычном
 * Node — так работает scripts/check.mjs.
 */
const bundledUrl = (): string => `${import.meta.env.BASE_URL}data/acts.json`
const remoteUrl = (): string => globalThis.window?.MALINA_CONFIG?.jsonUrl || ''

export interface LoadResult {
  payload: ActPayload
  fromCache: boolean
  /** Заполняется только вместе с fromCache: почему не удалось скачать свежие данные. */
  error?: Error
}

interface CacheEntry {
  savedAt: number
  payload: ActPayload
}

function readCache(): CacheEntry | null {
  const cached = readJson(CACHE_KEY, null) as CacheEntry | null
  if (!cached?.payload) return null
  return cached
}

async function fetchJson(url: string): Promise<ActPayload> {
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as ActPayload).items)) {
    throw new Error('неожиданный формат файла')
  }

  return payload as ActPayload
}

/**
 * Каждый заход на страницу делает реальный запрос: query с меткой времени
 * и cache: 'no-store' обходят кэш браузера и CDN GitHub Pages.
 */
export async function loadActs(): Promise<LoadResult> {
  const remote = remoteUrl()
  const sources = remote ? [remote, bundledUrl()] : [bundledUrl()]
  const problems: string[] = []

  for (const url of sources) {
    try {
      const payload = await fetchJson(url)
      writeJson(CACHE_KEY, { savedAt: Date.now(), payload })
      return { payload, fromCache: false }
    } catch (error) {
      problems.push(`${url}: ${(error as Error).message}`)
    }
  }

  const cached = readCache()
  if (cached) {
    return { payload: cached.payload, fromCache: true, error: new Error(problems.join('; ')) }
  }

  throw new Error(problems.join('; '))
}
