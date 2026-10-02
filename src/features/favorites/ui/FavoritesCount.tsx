import './FavoritesCount.css'
import type { Prefs } from '../../../entities/act/model/types.ts'

/** Счётчик избранного: он же переключатель режима «Только избранное». */
export default function FavoritesCount({
  count,
  onlyFavorites,
  onToggle,
}: {
  count: number
  onlyFavorites: boolean
  onToggle: (patch: Partial<Prefs>) => void
}) {
  if (count === 0) return null

  return (
    <button
      type="button"
      className={`favorites-count${onlyFavorites ? ' favorites-count--on' : ''}`}
      aria-pressed={onlyFavorites}
      title={onlyFavorites ? 'Показать всю ленту' : 'Показать только избранное'}
      onClick={() => onToggle({ onlyFavorites: !onlyFavorites })}
    >
      ★ {count}
    </button>
  )
}
