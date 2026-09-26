import { formatAge, formatUpdatedAt } from '../lib/acts.js'

export default function Freshness({ updatedAt, fromCache, loading, onRefresh }) {
  return (
    <div className="freshness">
      <span className="freshness__text">
        {loading ? (
          'Загружаю…'
        ) : updatedAt ? (
          <>
            <strong>Данные на {formatUpdatedAt(updatedAt)}</strong>
            <span className="freshness__age"> · {formatAge(updatedAt)}</span>
            {fromCache && <span className="freshness__warn"> · показана локальная копия</span>}
          </>
        ) : (
          'Данные ещё не загружены'
        )}
      </span>

      <button type="button" className="button" onClick={onRefresh} disabled={loading}>
        {loading ? 'Обновляю…' : 'Обновить'}
      </button>
    </div>
  )
}
