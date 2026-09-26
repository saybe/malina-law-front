import { formatDate } from '../lib/acts.js'

const CATEGORY_CLASS = {
  'Федеральный закон': 'law',
  'Федеральный конституционный закон': 'law',
  'Указ Президента': 'president',
  'Распоряжение Президента': 'president',
  'Постановление Правительства': 'government',
  'Распоряжение Правительства': 'government',
  'Государственная Дума': 'parliament',
  'Совет Федерации': 'parliament',
  'Конституционный Суд': 'court',
  'Кодекс': 'law',
  'Международный документ': 'international',
}

export default function ActCard({ act, favorite, onToggleFavorite }) {
  const tone = CATEGORY_CLASS[act.category] || 'other'
  const heading = [act.type, act.number ? `№ ${act.number}` : null].filter(Boolean).join(' ')

  return (
    <article className="card">
      <div className="card__head">
        <span className={`badge badge--${tone}`}>{act.category}</span>
        <time className="card__date" dateTime={act.date}>
          {formatDate(act.date)}
        </time>
        <button
          type="button"
          className={`star${favorite ? ' star--on' : ''}`}
          onClick={() => onToggleFavorite(act.id)}
          aria-pressed={favorite}
          title={favorite ? 'Убрать из избранного' : 'В избранное'}
        >
          {favorite ? '★' : '☆'}
          <span className="sr-only">{favorite ? 'Убрать из избранного' : 'В избранное'}</span>
        </button>
      </div>

      <h3 className="card__title">{heading}</h3>
      <p className="card__name">{act.name}</p>

      <a className="card__link" href={act.url} target="_blank" rel="noopener noreferrer">
        Открыть на портале&nbsp;↗
      </a>
    </article>
  )
}
