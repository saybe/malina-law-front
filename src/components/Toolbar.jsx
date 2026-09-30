import { RANGES } from '../lib/acts.js'

export default function Toolbar({ prefs, counts, favoriteCount, onChange, onReset }) {
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
          {favoriteCount > 0 && (
            <button
              type="button"
              className={`favorites-count${onlyFavorites ? ' favorites-count--on' : ''}`}
              aria-pressed={onlyFavorites}
              title={onlyFavorites ? 'Показать всю ленту' : 'Показать только избранное'}
              onClick={() => onChange({ onlyFavorites: !onlyFavorites })}
            >
              ★ {favoriteCount}
            </button>
          )}
          <button type="button" className="button button--ghost" onClick={onReset}>
            Сбросить
          </button>
        </div>
      </div>
    </div>
  )
}
