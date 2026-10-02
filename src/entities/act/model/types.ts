/**
 * Формат public/data/acts.json целиком описан в README.md.
 * Скрипт scripts/fetch.mjs собирает ровно эти поля — если меняешь схему,
 * правь и его, и этот файл, и scripts/check.mjs.
 */

/** Уровень акта: попадает ли он в федеральный срез портала. */
export type ActLevel = 'federal' | 'other'

/**
 * Категория определяется в fetch.mjs функцией guessCategory и приходит
 * готовой строкой. Список закрыт здесь, чтобы тональная метка в карточке
 * не могла незаметно выпасть в «Другой акт».
 */
export type ActCategory =
  | 'Федеральный конституционный закон'
  | 'Федеральный закон'
  | 'Указ Президента'
  | 'Распоряжение Президента'
  | 'Послание Президента'
  | 'Постановление Правительства'
  | 'Распоряжение Правительства'
  | 'Государственная Дума'
  | 'Совет Федерации'
  | 'Кодекс'
  | 'Конституционный Суд'
  | 'Ведомственный приказ'
  | 'Ведомственное распоряжение'
  | 'Постановление'
  | 'Акт суда'
  | 'Международный документ'
  | 'Другой акт'

/** Один опубликованный акт. `number` бывает null — акты без номера существуют. */
export interface Act {
  /** Номер опубликования: одновременно идентификатор и часть ссылки. */
  id: string
  type: string
  number: string | null
  /** Дата публикации в YYYY-MM-DD, всегда локальная, без сдвига пояса. */
  date: string
  name: string
  url: string
  category: ActCategory
  level: ActLevel
}

/** Раздел портала, из которого брались акты. */
export interface Section {
  id: string
  label: string
  count: number
  latest: string
}

/** Раздел без свежих актов: ограничение источника, а не сайта. */
export interface StaleSection {
  id: string
  label: string
  latest: string
}

export interface ActPayload {
  updatedAt: string
  source: string
  sourceUrl: string
  rangeDays: number
  cutoff: string
  counts: { total: number; federal: number; other: number }
  sections: Section[]
  staleSections: StaleSection[]
  items: Act[]
}

/** Настройки отображения, живут в localStorage. */
export interface Prefs {
  /** Период в днях как строка: '1' | '3' | '7' | '30' | '0' — где '0' значит «всё». */
  range: string
  showOther: boolean
  query: string
  onlyFavorites: boolean
}
