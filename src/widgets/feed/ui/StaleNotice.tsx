import '../../../shared/ui/notice.css'
import type { StaleSection } from '../../../entities/act/model/types.ts'
import { formatDate } from '../../../shared/lib/date.ts'

/**
 * Разделы портала, в которых нет свежих актов. Пользователь должен видеть,
 * что данные не пропали, — иначе решит, что сломался сайт.
 */
export default function StaleNotice({ sections }: { sections: StaleSection[] }) {
  if (sections.length === 0) return null

  const heading =
    sections.length === 1
      ? 'На самом портале нет свежих актов в разделе'
      : 'На самом портале нет свежих актов в разделах'

  const details = sections
    .map((section) =>
      section.latest
        ? `«${section.label}» — свежайшая от ${formatDate(section.latest)}`
        : `«${section.label}» — данных нет`,
    )
    .join('; ')

  return (
    <p className="notice notice--warn">
      {heading} {details}. Это ограничение источника, а не сайта.
    </p>
  )
}
