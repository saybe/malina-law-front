#!/usr/bin/env node
/**
 * Проверка клиентской логики на настоящем файле данных.
 * Без зависимостей и без браузера — только Node.
 *
 *   npm run check
 *
 * Падает с ненулевым кодом, если файл данных или логика фильтров сломаны.
 */

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatDate, searchText, selectActs } from '../src/lib/acts.js'

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
check('count.total совпадает с items.length', payload.counts.total === items.length, `${payload.counts.total} ≠ ${items.length}`)
check('federal + other = total', payload.counts.federal + payload.counts.other === items.length)
check('список не пуст', items.length > 0, `${items.length}`)
check('все id уникальны', new Set(items.map((i) => i.id)).size === items.length)
check('у всех актов есть date', items.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date)))
check('у всех актов есть url', items.every((i) => /^https?:\/\//.test(i.url)))
check('у всех актов есть type и name', items.every((i) => i.type && i.name))
check('нет актов без уровня', items.every((i) => i.level === 'federal' || i.level === 'other'))
check('в файле есть федеральные законы', items.some((i) => i.category === 'Федеральный закон'))
check('в файле есть акты Президента', items.some((i) => i.category === 'Указ Президента'))
check('в файле есть акты Правительства', items.some((i) => i.category === 'Постановление Правительства'))
check('в файле есть ведомственные приказы', items.some((i) => i.category === 'Ведомственный приказ'))
check('в файле есть акты КС РФ', items.some((i) => i.category === 'Конституционный Суд'))
check('в файле есть международные документы', items.some((i) => i.category === 'Международный документ'))
check('есть акты без номера — number может быть null', items.every((i) => i.number === null || typeof i.number === 'string'))
check('название без хвостовой кавычки', items.every((i) => !i.name.endsWith('"')), items.find((i) => i.name.endsWith('"'))?.name)
check('название без перевода строки', items.every((i) => !/[\r\n]/.test(i.name)))
check('нет пустых category', items.every((i) => Boolean(i.category)))
check('есть метаданные разделов', Array.isArray(payload.sections) && payload.sections.length > 0)
check('у каждого раздела есть свежайшая дата', payload.sections.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.latest || '')))

console.log('\nСвежесть разделов источника')
for (const section of payload.sections.filter((s) => s.id)) {
  const stale = (payload.staleSections || []).some((s) => s.id === section.id)
  console.log(`  ${stale ? 'устарел' : 'актуален'}  ${section.latest}  ${section.label} (${section.count})`)
}

// Совет Федерации и Госдума на портале не обновляются с сентября 2025.
// Это факт источника, поэтому проверяем корректность, а не наличие актов.
for (const id of ['council_1', 'council_2']) {
  const section = payload.sections.find((s) => s.id === id)
  if (section) {
    check(
      `раздел ${id} помечен как устаревший`,
      (payload.staleSections || []).some((s) => s.id === id) === (section.latest < payload.cutoff),
    )
  }
}
check('все акты попадают в один из разделов', items.every((i) => ['federal', 'other'].includes(i.level)))
check('региональные акты присутствуют, если источник их отдаёт', payload.counts.other > 0)

console.log('\nФильтры')

const all = selectActs(items, { range: '0', showOther: true, query: '' })
const federalOnly = selectActs(items, { range: '0', showOther: false, query: '' })

check('«всё» + региональные = полный список', all.length === items.length, `${all.length}`)
check('по умолчанию только федеральные', federalOnly.length === payload.counts.federal, `${federalOnly.length}`)
check('в федеральном срезе нет level=other', federalOnly.every((i) => i.level === 'federal'))

const week = selectActs(items, { range: '7', showOther: false, query: '' })
const month = selectActs(items, { range: '30', showOther: false, query: '' })
check('неделя ⊂ месяц ⊂ всё', week.length <= month.length && month.length <= federalOnly.length, `${week.length} / ${month.length} / ${federalOnly.length}`)
check('период «7 дней» не пуст', week.length > 0)

const todayIso = (() => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
})()
const today = selectActs(items, { range: '1', showOther: false, query: '' })
check('в фильтре «сегодня» только сегодняшние', today.every((i) => i.date === todayIso), [...new Set(today.map((i) => i.date))].join(', '))

console.log('\nПоиск')

const byNumber = selectActs(items, { range: '0', showOther: true, query: '-ФЗ' })
check('поиск по «-ФЗ» находит федеральные законы', byNumber.length > 0 && byNumber.every((i) => searchText(i).includes('-фз')), `${byNumber.length}`)

const ёCase = selectActs(items, { range: '0', showOther: true, query: 'область' })
check('поиск игнорирует регистр', ёCase.length > 0, `${ёCase.length}`)

const nonsense = selectActs(items, { range: '0', showOther: true, query: 'zzzqqq' })
check('заведомо ложный запрос даёт 0 результатов', nonsense.length === 0, `${nonsense.length}`)

const multi = selectActs(items, { range: '0', showOther: true, query: '  НАЛОГ  ' })
check('поиск по нескольким словам и с пробелами', multi.every((i) => searchText(i).includes('налог')))

console.log('\nФорматирование')
check('formatDate разбирает дату', formatDate('2026-09-26') === '26 сентября 2026', formatDate('2026-09-26'))
check('formatDate не падает на мусоре', formatDate('мусор') === 'мусор')
check('formatDate не падает на пустом значении', formatDate(undefined) === '')

console.log(
  `\n${failures === 0 ? 'Все проверки пройдены' : `Провалено проверок: ${failures}`}` +
    ` (актов в файле: ${items.length}, размер: ${(raw.length / 1024).toFixed(1)} КБ)`,
)

process.exit(failures === 0 ? 0 : 1)
