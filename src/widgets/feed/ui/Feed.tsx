import './Feed.css'
import type { DateGroup } from '../model/groupByDate.ts'
import type { ActSnapshot } from '../../../entities/act/model/select.ts'
import DayGroup from './DayGroup.tsx'

export interface FeedProps {
  groups: DateGroup[]
  isFavorite: (act: ActSnapshot) => boolean
  onToggleFavorite: (act: ActSnapshot) => void
}

export default function Feed({ groups, isFavorite, onToggleFavorite }: FeedProps) {
  return (
    <main className="feed">
      {groups.map((group) => (
        <DayGroup
          key={group.date}
          date={group.date}
          acts={group.acts}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </main>
  )
}
