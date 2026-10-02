/**
 * localStorage: настройки отображения и избранное.
 * Модуль браузерный — в нём есть localStorage, поэтому его нельзя импортировать
 * из scripts/check.mjs.
 */

import type { Prefs } from '../../entities/act/model/types.ts'

const FAVORITES_KEY = 'malina-law:favorites'
const PREFS_KEY = 'malina-law:prefs'

/** Единственный источник настроек по умолчанию: и загрузка, и сброс берут его отсюда. */
export const DEFAULT_PREFS: Prefs = {
  range: '7',
  showOther: false,
  query: '',
  onlyFavorites: false,
}

export function readJson(key: string, fallback: unknown): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* приватный режим или переполнение — работаем без кэша */
  }
}

export function loadPrefs(): Prefs {
  return { ...DEFAULT_PREFS, ...(readJson(PREFS_KEY, {}) as Partial<Prefs>) }
}

export function savePrefs(prefs: Prefs): void {
  writeJson(PREFS_KEY, prefs)
}

export function loadFavorites(): unknown {
  const value = readJson(FAVORITES_KEY, [])
  return Array.isArray(value) ? value : []
}

export function saveFavorites(acts: unknown): void {
  writeJson(FAVORITES_KEY, acts)
}
