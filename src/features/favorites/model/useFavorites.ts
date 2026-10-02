/**
 * Избранное: чтение, переключение и производный набор id.
 *
 * Вся логика — в entities/act/model/select.ts, её проверяет scripts/check.mjs.
 * Здесь только склейка React-состояния с localStorage.
 */

import { useCallback, useMemo, useState } from 'react'

import type { Act } from '../../../entities/act/model/types.ts'
import {
  favoriteIds as buildFavoriteIds,
  normalizeFavorites,
  toggleFavorite as toggleInList,
  type ActSnapshot,
} from '../../../entities/act/model/select.ts'
import { loadFavorites, saveFavorites } from '../../../shared/lib/storage.ts'

export interface FavoritesState {
  favorites: ActSnapshot[]
  /** id отмеченных актов. Наружу отдаётся вместе с isFavorite — карточке нужен boolean. */
  favoriteIds: ReadonlySet<string>
  isFavorite: (act: ActSnapshot) => boolean
  toggleFavorite: (act: ActSnapshot) => void
}

export function useFavorites(items: Act[]): FavoritesState {
  const [stored, setStored] = useState<unknown>(() => loadFavorites())

  const favorites = useMemo(() => normalizeFavorites(stored, items), [stored, items])
  const ids = useMemo(() => buildFavoriteIds(favorites), [favorites])

  // Список favorites в замыкании — поэтому хук зависит от него.
  const toggleFavorite = useCallback(
    (act: ActSnapshot) => {
      const next = toggleInList(favorites, act)
      setStored(next)
      saveFavorites(next)
    },
    [favorites],
  )

  const isFavorite = useCallback((act: ActSnapshot) => ids.has(act.id), [ids])

  return { favorites, favoriteIds: ids, isFavorite, toggleFavorite }
}
