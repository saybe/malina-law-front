#!/usr/bin/env node
/**
 * Проверка клиентской логики на настоящем файле данных.
 * Без зависимостей и без браузера — только Node.
 *
 *   npm run check
 *
 * Падает с ненулевым кодом, если файл данных или логика фильтров сломаны.
 *
 * Импортируется не исходник, а его сборка из .check-out: скрипт остаётся
 * обычным Node, а типы снимает tsc (см. tsconfig.check.json). Поэтому
 * проверяться могут только чистые модули — те, где нет fetch, localStorage
 * и import.meta.env.
 */

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  favoriteIds,
  normalizeFavorites,
  searchText,
  selectActs,
  selectFavorites,
  toggleFavorite,
} from '../.check-out/entities/act/model/select.js'
import { formatDate, formatDateShort } from '../.check-out/shared/lib/date.js'
import { groupByDate } from '../.check-out/widgets/feed/model/groupByDate.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = resolve(ROOT, 'public/data/acts.json')

let failures = 0

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const raw = await readFile(DATA_FILE, 'utf8')
const payload = JSON.parse(raw)
const items = payload.items

console.log('Данные')
check('updatedAt в ISO-формате', !Number.isNaN(Date.parse(payload.updatedAt)))
check('есть счётчики', typeof payload.counts?.total === 'number')
check(
  'count.total совпадает с items.length',
  payload.counts.total === items.length,
  `${payload.counts.total} ≠ ${items.length}`,
)
check('federal + other = total', payload.counts.federal + payload.counts.other === items.length)
check('список не пуст', items.length > 0, `${items.length}`)
check('все id уникальны', new Set(items.map((i) => i.id)).size === items.length)
check(
  'у всех актов есть date',
  items.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date)),
)
check(
  'у всех актов есть url',
  items.every((i) => /^https?:\/\//.test(i.url)),
)
check(
  'у всех актов есть type и name',
  items.every((i) => i.type && i.name),
)
check(
  'нет актов без уровня',
  items.every((i) => i.level === 'federal' || i.level === 'other'),
)
check(
  'в файле есть федеральные законы',
  items.some((i) => i.category === 'Федеральный закон'),
)
check(
  'в файле есть акты Президента',
  items.some((i) => i.category === 'Указ Президента'),
)
check(
  'в файле есть акты Правительства',
  items.some((i) => i.category === 'Постановление Правительства'),
)
check(
  'в файле есть ведомственные приказы',
  items.some((i) => i.category === 'Ведомственный приказ'),
)
check(
  'в файле есть акты КС РФ',
  items.some((i) => i.category === 'Конституционный Суд'),
)
check(
  'в файле есть международные документы',
  items.some((i) => i.category === 'Международный документ'),
)
check(
  'есть акты без номера — number может быть null',
  items.every((i) => i.number === null || typeof i.number === 'string'),
)
check(
  'название без хвостовой кавычки',
  items.every((i) => !i.name.endsWith('"')),
  items.find((i) => i.name.endsWith('"'))?.name,
)
check(
  'название без перевода строки',
  items.every((i) => !/[\r\n]/.test(i.name)),
)
check(
  'нет пустых category',
  items.every((i) => Boolean(i.category)),
)
check('есть метаданные разделов', Array.isArray(payload.sections) && payload.sections.length > 0)
check(
  'у каждого раздела есть свежайшая дата',
  payload.sections.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.latest || '')),
)

console.log('\nСвежесть разделов источника')
for (const section of payload.sections.filter((s) => s.id)) {
  const stale = (payload.staleSections || []).some((s) => s.id === section.id)
  console.log(
    `  ${stale ? 'устарел' : 'актуален'}  ${section.latest}  ${section.label} (${section.count})`,
  )
}

// Совет Федерации и Госдума на портале не обновляются с сентября 2025.
// Это факт источника, поэтому проверяем корректность, а не наличие актов.
for (const id of ['council_1', 'council_2']) {
  const section = payload.sections.find((s) => s.id === id)
  if (section) {
    check(
      `раздел ${id} помечен как устаревший`,
      (payload.staleSections || []).some((s) => s.id === id) === section.latest < payload.cutoff,
    )
  }
}
check(
  'все акты попадают в один из разделов',
  items.every((i) => ['federal', 'other'].includes(i.level)),
)
check('региональные акты присутствуют, если источник их отдаёт', payload.counts.other > 0)

console.log('\nФильтры')

const all = selectActs(items, { range: '0', showOther: true, query: '' })
const federalOnly = selectActs(items, { range: '0', showOther: false, query: '' })

check('«всё» + региональные = полный список', all.length === items.length, `${all.length}`)
check(
  'по умолчанию только федеральные',
  federalOnly.length === payload.counts.federal,
  `${federalOnly.length}`,
)
check(
  'в федеральном срезе нет level=other',
  federalOnly.every((i) => i.level === 'federal'),
)

const week = selectActs(items, { range: '7', showOther: false, query: '' })
const month = selectActs(items, { range: '30', showOther: false, query: '' })
check(
  'неделя ⊂ месяц ⊂ всё',
  week.length <= month.length && month.length <= federalOnly.length,
  `${week.length} / ${month.length} / ${federalOnly.length}`,
)
check('период «7 дней» не пуст', week.length > 0)

const todayIso = (() => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
})()
const today = selectActs(items, { range: '1', showOther: false, query: '' })
check(
  'в фильтре «сегодня» только сегодняшние',
  today.every((i) => i.date === todayIso),
  [...new Set(today.map((i) => i.date))].join(', '),
)

console.log('\nПоиск')

const byNumber = selectActs(items, { range: '0', showOther: true, query: '-ФЗ' })
check(
  'поиск по «-ФЗ» находит федеральные законы',
  byNumber.length > 0 && byNumber.every((i) => searchText(i).includes('-фз')),
  `${byNumber.length}`,
)

const ёCase = selectActs(items, { range: '0', showOther: true, query: 'область' })
check('поиск игнорирует регистр', ёCase.length > 0, `${ёCase.length}`)

const nonsense = selectActs(items, { range: '0', showOther: true, query: 'zzzqqq' })
check('заведомо ложный запрос даёт 0 результатов', nonsense.length === 0, `${nonsense.length}`)

const multi = selectActs(items, { range: '0', showOther: true, query: '  НАЛОГ  ' })
check(
  'поиск по нескольким словам и с пробелами',
  multi.every((i) => searchText(i).includes('налог')),
)

console.log('\nИзбранное')

const sample = items.slice(0, 3)
const fresh = normalizeFavorites([sample[0].id], items)
check(
  'старый формат с id апгрейдится до снимка',
  fresh.length === 1 && fresh[0].name === sample[0].name,
)
check('старый формат с id берёт акт из свежих данных', fresh[0] === sample[0])

// Снимок, которого больше нет в acts.json, обязан выжить: id живёт только
// внутри файла данных, акт вытесняется лимитом 200 или окном в 60 дней.
const gone = { ...sample[1], date: '2020-01-01' }
const kept = normalizeFavorites(
  [gone],
  items.filter((i) => i.id !== sample[1].id),
)
check(
  'снимок, отсутствующий в данных, сохраняется',
  kept.length === 1 && kept[0].id === sample[1].id,
  `${kept.length}`,
)
// Нет ссылки — показать акт нечем, такую запись смысла хранить нет.
check(
  'снимок без url отбрасывается',
  normalizeFavorites([{ id: 'нет-такого-акта' }], items).length === 0,
)
// Известный id без url не отбрасывается: он берётся из свежих данных.
check(
  'известный id без url восстанавливается из данных',
  normalizeFavorites([{ id: sample[2].id }], items).length === 1,
)

const stale = normalizeFavorites([gone, sample[0]], items)
check('при наличии в данных снимок обновляется свежим', stale[1] === sample[0], stale[1]?.name)
check(
  'дубликаты по id схлопываются',
  normalizeFavorites([sample[0], sample[0].id], items).length === 1,
)
check(
  'мусор на входе не ломает нормализацию',
  normalizeFavorites([null, 42, {}, ''], items).length === 0,
)
check('не-массив на входе даёт пустой список', normalizeFavorites(null, items).length === 0)

const marked = normalizeFavorites([sample[0], sample[1]], items)
check('selectFavorites отдаёт всё отмеченное', selectFavorites(marked, { query: '' }).length === 2)
check(
  'selectFavorites игнорирует период',
  selectFavorites(marked, { query: '', range: '1' }).length === 2,
)
check(
  'selectFavorites игнорирует региональные акты',
  selectFavorites(marked, { query: '', showOther: false }).length === 2,
)
const token = String(sample[0].type).toLowerCase().split(/\s+/)[0]
const found = selectFavorites(marked, { query: token })
check(
  'selectFavorites применяет поиск',
  found.some((i) => i.id === sample[0].id) && found.every((i) => searchText(i).includes(token)),
  token,
)
check(
  'selectFavorites на заведомо ложном запросе пуст',
  selectFavorites(marked, { query: 'zzzqqq' }).length === 0,
)
check(
  'selectFavorites на пустом входе даёт пустой список',
  selectFavorites([], { query: '' }).length === 0,
)

// Избранное должно переживать смену acts.json: снимок в localStorage не зависит
// от того, остался ли акт в свежей выдаче портала.
const oldest = [...items].sort((a, b) => a.date.localeCompare(b.date))[0]
const survives = normalizeFavorites([oldest], [])
check('избранное переживает пустую выдачу', survives.length === 1 && survives[0].url === oldest.url)

// Регрессия: favoriteIds собирался как new Set(favorites), то есть множество
// объектов, а карточка спрашивала по id. Звезда не подсвечивалась никогда.
const ids = favoriteIds(marked)
check(
  'favoriteIds содержит id отмеченных актов',
  marked.every((act) => ids.has(act.id)) && ids.size === marked.length,
)
check('favoriteIds не содержит неотмеченных', !ids.has('0000000000000000'))
check('favoriteIds на пустом избранном пуст', favoriteIds([]).size === 0)
check(
  'отмеченный акт находится через favoriteIds после нормализации',
  favoriteIds(normalizeFavorites([sample[0].id], items)).has(sample[0].id),
)

let toggled = toggleFavorite([], marked[0])
check('toggleFavorite добавляет акт', toggled.length === 1 && toggled[0].id === marked[0].id)
toggled = toggleFavorite(toggled, marked[1])
check('toggleFavorite добавляет второй акт', toggled.length === 2)
check('toggleFavorite кладёт новый акт в начало', toggled[0].id === marked[1].id)
toggled = toggleFavorite(toggled, marked[0])
check('toggleFavorite снимает отметку', toggled.length === 1 && toggled[0].id === marked[1].id)
check(
  'toggleFavorite дважды возвращает исходное состояние',
  toggleFavorite(toggleFavorite(marked, sample[0]), sample[0]).length === marked.length,
)
check('toggleFavorite не мутирует исходный список', marked.length === 2)
check(
  'toggleFavorite отличающийся id не снимает отметку',
  toggleFavorite(marked, { id: 'другой', url: 'https://example.org' }).length === 3,
)

console.log('\nГруппировка по датам')

const grouped = groupByDate(items)
const totalGrouped = grouped.reduce((sum, group) => sum + group.acts.length, 0)
check(
  'все акты попали в группы',
  totalGrouped === items.length,
  `${totalGrouped} ≠ ${items.length}`,
)
check('на каждый день одна группа', new Set(grouped.map((g) => g.date)).size === grouped.length)
check(
  'в группе ровно те акты, что с этой датой',
  grouped.every((group) => group.acts.every((act) => act.date === group.date)),
)
check('пустой список даёт пустые группы', groupByDate([]).length === 0)

// Порядок дней задаёт выдача, а не сортировка внутри groupByDate.
const scrambled = groupByDate([sample[0], { ...sample[1], date: sample[0].date }, oldest])
check(
  'дни идут в порядке первого появления',
  scrambled.map((g) => g.date).join(',') === [sample[0].date, oldest.date].join(','),
  scrambled.map((g) => g.date).join(','),
)
check('акты одного дня не переставляются', scrambled[0].acts[0].id === sample[0].id)
check('в группе дня столько же актов, сколько пришло', scrambled[0].acts.length === 2)

// Снимок без даты не должен выпадать из ленты.
const dateless = groupByDate([{ id: 'без-даты', url: 'https://example.org' }])
check('снимок без даты не теряется', dateless.length === 1 && dateless[0].acts.length === 1)

console.log('\nФорматирование')
check(
  'formatDate разбирает дату',
  formatDate('2026-09-26') === '26 сентября 2026',
  formatDate('2026-09-26'),
)
check('formatDate не падает на мусоре', formatDate('мусор') === 'мусор')
check('formatDate не падает на пустом значении', formatDate(undefined) === '')
check(
  'formatDateShort разбирает дату',
  formatDateShort('2026-09-26') === '26.09.2026',
  formatDateShort('2026-09-26'),
)
check(
  'formatDateShort дополняет день и месяц нулём',
  formatDateShort('2026-01-05') === '05.01.2026',
  formatDateShort('2026-01-05'),
)
check('formatDateShort не падает на мусоре', formatDateShort('мусор') === 'мусор')
check('formatDateShort не падает на пустом значении', formatDateShort(undefined) === '')

console.log(
  `\n${failures === 0 ? 'Все проверки пройдены' : `Провалено проверок: ${failures}`}` +
    ` (актов в файле: ${items.length}, размер: ${(raw.length / 1024).toFixed(1)} КБ)`,
)

process.exit(failures === 0 ? 0 : 1)
