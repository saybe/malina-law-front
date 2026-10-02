import './Freshness.css'
import '../../../shared/ui/button.css'
import { formatAge, formatUpdatedAt } from '../../../shared/lib/date.ts'

export interface FreshnessProps {
  updatedAt: string | undefined
  fromCache: boolean
  loading: boolean
  onRefresh: () => void
}

export default function Freshness({ updatedAt, fromCache, loading, onRefresh }: FreshnessProps) {
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
