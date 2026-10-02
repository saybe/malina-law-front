/**
 * Группировка ленты по дате публикации — так список читается как хроника.
 * Чистая функция, проверяется в scripts/check.mjs.
 */

import type { Act } from '../../../entities/act/model/types.ts'
import type { ActSnapshot } from '../../../entities/act/model/select.ts'

/**
 * Один день ленты: дата в YYYY-MM-DD и акты за неё.
 * Название не DayGroup, чтобы не совпадать с компонентом widgets/feed/ui/DayGroup.
 */
export interface DateGroup<T extends Act | ActSnapshot = ActSnapshot> {
  date: string
  acts: T[]
}

/** Порядок внутри строки сохраняется: дни идут в том порядке, в каком пришли акты. */
export function groupByDate<T extends Act | ActSnapshot>(acts: T[]): DateGroup<T>[] {
  const groups = new Map<string, T[]>()

  for (const act of acts) {
    // У снимка из избранного дата может отсутствовать: он приходит из localStorage.
    // Такая запись попадает в группу с пустой датой, а не теряется.
    const date = act.date ?? ''
    const bucket = groups.get(date)
    if (bucket) bucket.push(act)
    else groups.set(date, [act])
  }

  return [...groups.entries()].map(([date, groupActs]) => ({ date, acts: groupActs }))
}
