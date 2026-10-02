#!/usr/bin/env node
/**
 * Смоук-тест вёрстки: рендерит компоненты в статическую разметку и проверяет,
 * что получилось то, что ожидалось.
 *
 *   npm run smoke
 *
 * scripts/check.mjs проверяет чистые функции и вёрстку не видит. Именно на шве
 * между App и компонентами уже жила ошибка: карточка спрашивала favorite по id,
 * а App отдавал множество объектов, поэтому звезда избранного не подсвечивалась
 * никогда, а все проверки данных были зелёными.
 *
 * Браузер не нужен: SSR-сборку делает Vite, рендер — react-dom/server.
 * Зависимостей сверх уже установленных devDeps нет.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = pathToFileURL(resolve(ROOT, '.smoke-out/smoke-entry.js')).href

let failures = 0

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/**
 * Браузерные API в Node отсутствуют. Подменяем ровно то, что читает страница:
 * localStorage — настройки, избранное и кэш; fetch — загрузка данных.
 */
function installBrowserStubs(seed = {}) {
  const store = new Map(Object.entries(seed))

  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ items: [] }) })

  return store
}

const ACT = {
  id: '0001202609300001',
  type: 'Постановление Конституционного Суда Российской Федерации',
  number: '56-П',
  date: '2026-09-30',
  name: 'о проверке конституционности пункта 1 части 2 статьи 24',
  url: 'http://publication.pravo.gov.ru/document/0001202609300001',
  category: 'Конституционный Суд',
  level: 'federal',
}

const noop = () => {}

const { App, ActCard, Toolbar, Feed, DayGroup, StaleNotice } = await import(BUNDLE)

const render = (Component, props) => renderToStaticMarkup(createElement(Component, props))

/* ------------------------------------------------------------------ */

console.log('Звезда избранного')

const marked = render(ActCard, { act: ACT, favorite: true, onToggleFavorite: noop })
const plain = render(ActCard, { act: ACT, favorite: false, onToggleFavorite: noop })

// Регрессия: favorite приходил не тем, чем проверяли.
check('отмеченная карточка получает star--on', marked.includes('star star--on'))
check('отмеченная карточка помечена aria-pressed', marked.includes('aria-pressed="true"'))
check('отмеченная карточка рисует ★', marked.includes('★') && !marked.includes('☆'))
check('неотмеченная карточка без star--on', !plain.includes('star--on'))
check('неотмеченная карточка помечена aria-pressed', plain.includes('aria-pressed="false"'))
check('неотмеченная карточка рисует ☆', plain.includes('☆'))

console.log('\nТон метки по категориям')

const toneOf = (category) =>
  render(ActCard, { act: { ...ACT, category }, favorite: false, onToggleFavorite: noop }).match(
    /badge badge--([a-z]+)/,
  )?.[1]

for (const [category, expected] of [
  ['Федеральный закон', 'law'],
  ['Кодекс', 'law'],
  ['Указ Президента', 'president'],
  ['Послание Президента', 'president'],
  ['Постановление Правительства', 'government'],
  ['Государственная Дума', 'parliament'],
  ['Конституционный Суд', 'court'],
  ['Акт суда', 'court'],
  ['Международный документ', 'international'],
  ['Ведомственный приказ', 'other'],
  ['Другой акт', 'other'],
]) {
  check(`${category} → ${expected}`, toneOf(category) === expected, `получено ${toneOf(category)}`)
}

console.log('\nЧастичный снимок из избранного')

const partial = render(ActCard, {
  act: { id: 'без-полей', url: 'http://example.org/x' },
  favorite: true,
  onToggleFavorite: noop,
})

check('не падает без type, name и date', partial.includes('Правовой акт'))
check('дата выводится пустой, верстка цела', partial.includes('card__date'))
check('категория не превращается в undefined', partial.includes('Другой акт'))
check('ссылка остаётся рабочей', partial.includes('href="http://example.org/x"'))

console.log('\nЛента передаёт отметку вниз')

// Проверяется вся цепочка Feed → DayGroup → ActCard. Рендерить ActCard
// напрямую недостаточно: баг был именно в том, что вниз уходило не то значение.
const OTHER = { ...ACT, id: '0001202609300002', type: 'Указ Президента', number: '700' }
const isFavorite = (act) => act.id === ACT.id

const feed = render(Feed, {
  groups: [{ date: ACT.date, acts: [ACT, OTHER] }],
  isFavorite,
  onToggleFavorite: noop,
})

check('отмеченный акт подсвечен в ленте', feed.includes('star star--on'))
check('неотмеченный акт остался пустым', feed.includes('☆'))
check('в группе обе карточки', (feed.match(/class="card"/g) || []).length === 2)
check('заголовок дня на месте', feed.includes('day__title'))
check('счётчик актов в дне', feed.includes('day__count'))
check('ссылка ведёт на портал', feed.includes(ACT.url))

const dayGroup = render(DayGroup, {
  date: ACT.date,
  acts: [ACT],
  isFavorite,
  onToggleFavorite: noop,
})
check('секция дня тоже передаёт отметку', dayGroup.includes('star star--on'))

const noneMarked = render(Feed, {
  groups: [{ date: ACT.date, acts: [ACT] }],
  isFavorite: () => false,
  onToggleFavorite: noop,
})
check('если никто не отмечен — звёзд нет', !noneMarked.includes('star--on'))

console.log('\nПанель фильтров')

const prefs = { range: '7', showOther: false, query: '', onlyFavorites: false }
const toolbar = render(Toolbar, {
  prefs,
  counts: { visible: 3, total: 100 },
  favoriteCount: 2,
  onChange: noop,
  onReset: noop,
})

check('период отмечен по prefs', toolbar.includes('segmented__item--on" aria-pressed="true"'))
check('поиск пуст, а не undefined', !toolbar.includes('value="undefined"'))
check('счётчик избранного виден', toolbar.includes('★ 2'))
check('счётчик показывает режим избранного', toolbar.includes('aria-pressed="false"'))

console.log('\nПредупреждение об устаревших разделах')

check('пустой список разделов не рисует ничего', render(StaleNotice, { sections: [] }) === '')
check(
  'один раздел читается по-человечески',
  render(StaleNotice, {
    sections: [{ id: 'council_1', label: 'Совет Федерации', latest: '2025-09-24' }],
  }).includes('в разделе «Совет Федерации» — свежайшая от 24 сентября 2025'),
)
check(
  'несколько разделов читаются по-человечески',
  render(StaleNotice, {
    sections: [
      { id: 'council_1', label: 'Совет Федерации', latest: '2025-09-24' },
      { id: 'council_2', label: 'Государственная Дума', latest: '' },
    ],
  }).includes('в разделах'),
)
check(
  'без даты пишется «данных нет»',
  render(StaleNotice, {
    sections: [{ id: 'x', label: 'Раздел', latest: '' }],
  }).includes('«Раздел» — данных нет'),
)

console.log('\nПриложение целиком')

installBrowserStubs({
  'malina-law:favorites': JSON.stringify([ACT]),
  'malina-law:prefs': JSON.stringify(prefs),
})

const app = render(App)

// useEffect не выполняется при статическом рендере, поэтому useFeed остаётся
// в состоянии загрузки и лента пуста — так же, как до первого ответа сети.
check('отрендерилось без исключений', app.length > 500, `${app.length} символов`)
check('заголовок на месте', app.includes('Обновления законодательства РФ'))
check('индикатор загрузки на месте', app.includes('Загружаю…'))
check('панель фильтров на месте', app.includes('class="toolbar"'))
check('избранное прочитано и показано в панели', app.includes('favorites-count'))
check('до загрузки данных показан пустой список', app.includes('Ничего не найдено'))

console.log(`\n${failures === 0 ? 'Смоук-тест пройден' : `Провалено проверок: ${failures}`}`)

process.exit(failures === 0 ? 0 : 1)
