import { formatDate } from '../../../shared/lib/date.ts'

export interface EmptyNoticeProps {
  onlyFavorites: boolean
  favoritesCount: number
  /** Откуда начинается доступная история — показывается, когда пусто из-за периода. */
  cutoff: string | undefined
}

export default function EmptyNotice({ onlyFavorites, favoritesCount, cutoff }: EmptyNoticeProps) {
  const text = onlyFavorites
    ? favoritesCount === 0
      ? 'В избранном пока ничего нет. Нажмите на звезду у карточки, чтобы сохранить акт.'
      : 'Ничего не найдено среди избранного. Попробуйте изменить запрос.'
    : 'Ничего не найдено. Попробуйте расширить период или изменить запрос.'

  return (
    <p className="notice">
      {text}
      {!onlyFavorites && cutoff && ` Данные доступны с ${formatDate(cutoff)}.`}
    </p>
  )
}
