import './Toolbar.css'
import '../../../shared/ui/button.css'
import type { Prefs } from '../../../entities/act/model/types.ts'
import FavoritesCount from '../../favorites/ui/FavoritesCount.tsx'
import { RANGES } from '../model/ranges.ts'

export interface ToolbarCounts {
  visible: number
  total: number
}

export interface ToolbarProps {
  prefs: Prefs
  counts: ToolbarCounts
  favoriteCount: number
  onChange: (patch: Partial<Prefs>) => void
  onReset: () => void
}

export default function Toolbar({ prefs, counts, favoriteCount, onChange, onReset }: ToolbarProps) {
  const { range, showOther, query, onlyFavorites } = prefs

  return (
    <div className="toolbar">
      <div className="toolbar__row">
        <div className="segmented" role="group" aria-label="Период">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented__item${range === option.value ? ' segmented__item--on' : ''}`}
              aria-pressed={range === option.value}
              onClick={() => onChange({ range: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="switches">
          <label className="switch">
            <input
              type="checkbox"
              checked={showOther}
              onChange={(event) => onChange({ showOther: event.target.checked })}
            />
            <span>Включая региональные акты</span>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(event) => onChange({ onlyFavorites: event.target.checked })}
            />
            <span>Только избранное</span>
          </label>
        </div>
      </div>

      <div className="toolbar__row">
        <input
          className="search"
          type="search"
          value={query}
          placeholder="Поиск по названию, номеру или дате — например: 412-ФЗ, НДФЛ, налог"
          onChange={(event) => onChange({ query: event.target.value })}
        />

        <div className="toolbar__meta">
          <span>
            {counts.visible} из {counts.total}
          </span>
          <FavoritesCount count={favoriteCount} onlyFavorites={onlyFavorites} onToggle={onChange} />
          <button type="button" className="button button--ghost" onClick={onReset}>
            Сбросить
          </button>
        </div>
      </div>
    </div>
  )
}
