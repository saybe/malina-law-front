import './DayGroup.css'
import ActCard from '../../../entities/act/ui/ActCard.tsx'
import type { ActSnapshot } from '../../../entities/act/model/select.ts'
import { formatDate, today } from '../../../shared/lib/date.ts'

export interface DayGroupProps {
  date: string
  acts: ActSnapshot[]
  isFavorite: (act: ActSnapshot) => boolean
  onToggleFavorite: (act: ActSnapshot) => void
}

export default function DayGroup({ date, acts, isFavorite, onToggleFavorite }: DayGroupProps) {
  const isToday = date === today()

  return (
    <section className="day">
      <h2 className={`day__title${isToday ? ' day__title--today' : ''}`}>
        {isToday ? 'Сегодня' : formatDate(date)}
        <span className="day__count">{acts.length}</span>
      </h2>

      <div className="day__cards">
        {acts.map((act) => (
          <ActCard
            key={act.id}
            act={act}
            favorite={isFavorite(act)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  )
}
