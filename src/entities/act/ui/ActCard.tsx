import type { ActCategory } from '../model/types.ts'
import type { ActSnapshot } from '../model/select.ts'
import { formatDateShort } from '../../../shared/lib/date.ts'

type Tone = 'law' | 'president' | 'government' | 'parliament' | 'court' | 'international' | 'other'

/**
 * Тон метки по категории. Список закрыт categories из fetch.mjs: любая
 * неразобранная категория молча получила бы серый «other», поэтому
 * «Акт суда» и «Послание Президента» раскиданы по своим тонам вручную.
 */
const CATEGORY_TONE: Partial<Record<ActCategory, Tone>> = {
  'Федеральный закон': 'law',
  'Федеральный конституционный закон': 'law',
  Кодекс: 'law',
  'Указ Президента': 'president',
  'Распоряжение Президента': 'president',
  'Послание Президента': 'president',
  'Постановление Правительства': 'government',
  'Распоряжение Правительства': 'government',
  'Государственная Дума': 'parliament',
  'Совет Федерации': 'parliament',
  'Конституционный Суд': 'court',
  'Акт суда': 'court',
  'Международный документ': 'international',
}

export interface ActCardProps {
  act: ActSnapshot
  favorite: boolean
  onToggleFavorite: (act: ActSnapshot) => void
}

export default function ActCard({ act, favorite, onToggleFavorite }: ActCardProps) {
  const tone = (act.category && CATEGORY_TONE[act.category]) || 'other'
  // «Правовой акт» — тот же запасной текст, что подставляет fetch.mjs,
  // когда тип не удалось разобрать.
  const heading = [act.type || 'Правовой акт', act.number ? `№ ${act.number}` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <article className="card">
      <div className="card__head">
        <span className={`badge badge--${tone}`}>{act.category || 'Другой акт'}</span>
        <time className="card__date" dateTime={act.date}>
          {formatDateShort(act.date)}
        </time>
        <button
          type="button"
          className={`star${favorite ? ' star--on' : ''}`}
          onClick={() => onToggleFavorite(act)}
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
