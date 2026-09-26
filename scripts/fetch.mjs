#!/usr/bin/env node
/**
 * Скачивает актуальные правовые акты с официального интернет-портала
 * правовой информации и складывает их в public/data/acts.json.
 *
 * Запускается из GitHub Actions (см. .github/workflows/update.yml).
 * Зависимостей нет — только стандартная библиотека Node 20+.
 *
 *   npm run fetch
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = resolve(ROOT, 'public/data/acts.json')

/**
 * Портал отдаёт данные только по HTTP — на 443 TLS не отвечает. Поэтому фид
 * забирает GitHub Actions, а страница читает готовый JSON с того же origin.
 */
const FEED_BASE = 'http://publication.pravo.gov.ru/api/rss'

/** Максимальный размер страницы, который принимает портал. */
const PAGE_SIZE = 200

/**
 * Сколько дней истории держим в файле. Окно нужно шире «месяца», потому что
 * федеральные законы публикуются пачками: в проверенных данных 78 ФЗ вышли
 * одним днём, а между пачками проходит несколько недель.
 */
const RANGE_DAYS = 60

const TIMEOUT_MS = 45_000
const ATTEMPTS = 3
const GAP_MS = 700

/**
 * Федеральные блоки портала. Региональные акты в них не попадают,
 * поэтому они составляют «федеральный срез» сайта.
 */
const FEDERAL_BLOCKS = [
  { id: 'president', label: 'Президент Российской Федерации' },
  { id: 'government', label: 'Правительство Российской Федерации' },
  { id: 'council_1', label: 'Совет Федерации' },
  { id: 'council_2', label: 'Государственная Дума' },
  { id: 'federal_authorities', label: 'Федеральные органы исполнительной власти' },
  { id: 'court', label: 'Конституционный Суд' },
  { id: 'international', label: 'Международные документы' },
]

/**
 * Общая лента: нужна для режима «включая региональные акты».
 * id === null означает «без параметра block» — любой непустой несуществующий
 * блок (например block=all) портал отвергает с HTTP 500.
 */
const ALL_BLOCK = { id: null, label: 'Все акты' }

const DAY_MS = 86_400_000

/* ------------------------------------------------------------------ */
/* HTTP                                                                 */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(url) {
  let lastError

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'malina-law-front/1.0 (+https://github.com/saybe/malina-law-front)',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)

      return await response.text()
    } catch (error) {
      lastError = error
      const reason = error.name === 'AbortError' ? `таймаут ${TIMEOUT_MS} мс` : error.message
      if (attempt < ATTEMPTS) {
        const wait = attempt * 3000
        console.warn(`  попытка ${attempt}/${ATTEMPTS} не удалась (${reason}), повтор через ${wait / 1000} с`)
        await sleep(wait)
      } else {
        console.warn(`  попытка ${attempt}/${ATTEMPTS} не удалась: ${reason}`)
      }
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError
}

/* ------------------------------------------------------------------ */
/* Разбор RSS                                                           */
/* ------------------------------------------------------------------ */

/*
 * ВАЖНО про регулярные выражения в этом файле.
 *
 * В JavaScript \b и \w работают только по ASCII: кириллица «word-символом»
 * не считается. Поэтому /Протокол\b/ не срабатывает никогда — после «л»
 * идёт пробел, а границы слов между двумя не-ASCII символами нет.
 * Аналогично \w+ не матчит кириллицу. Для русских текстов используем
 * явный lookahead (?![А-Яа-яЁёA-Za-z0-9]).
 */

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
}

function decodeEntities(input) {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X'
      const code = parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    const known = ENTITIES[entity]
    return known === undefined ? match : known
  })
}

const collapse = (s) => s.replace(/\s+/g, ' ').trim()

const tag = (xml, name) => {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return match ? collapse(decodeEntities(match[1])) : null
}

/**
 * Отрезает номер от названия. Название начинается либо с кавычки, либо со
 * скобки — в ленте встречается «№ 315-рп (О назначении …)».
 */
function splitNumberAndName(body) {
  let head = body.replace(/^№\s*/, '')
  let name = ''

  const delimiters = [head.indexOf('"'), head.indexOf('(')].filter((i) => i >= 0)
  if (delimiters.length) {
    const at = Math.min(...delimiters)
    name = head.slice(at + 1)
    head = head.slice(0, at)
  }

  // Постановления КС РФ: «№ 55-П по делу о проверке …» — «по делу» не часть номера.
  const caseAt = head.search(/\s+по\s+делу(?![А-Яа-яЁёA-Za-z])/i)
  if (caseAt >= 0) {
    const casePart = head.slice(caseAt).trim().replace(/^по\s+делу\s*/i, '')
    name = `${casePart} ${name}`.trim()
    head = head.slice(0, caseAt)
  }

  head = head.trim()
  if (head === '') return { number: null, name: cleanName(name) }

  // Номер — одно или два слова: «680», «412-ФЗ», «9115-8 ГД», «ЕД-1-9/605@».
  const tokens = head.split(/\s+/)
  const number = tokens.slice(0, 2).join(' ')
  const rest = tokens.slice(2).join(' ').trim()

  return { number, name: cleanName(`${rest} ${name}`) }
}

const cleanName = (value) => collapse(value).replace(/^["«(]+/, '').replace(/["»)]+$/, '').trim()

/** Первое слово-заголовок вида «Федеральный закон», «Указ Президента РФ» и т. п. */
function guessCategory(type) {
  const t = (type || '').toLowerCase()
  if (t.startsWith('федеральный конституционный закон')) return 'Федеральный конституционный закон'
  if (t.startsWith('федеральный закон')) return 'Федеральный закон'
  if (t.startsWith('указ президента')) return 'Указ Президента'
  if (t.startsWith('распоряжение президента')) return 'Распоряжение Президента'
  if (t.startsWith('послание президента')) return 'Послание Президента'
  if (t.startsWith('постановление правительства')) return 'Постановление Правительства'
  if (t.startsWith('распоряжение правительства')) return 'Распоряжение Правительства'
  if (t.startsWith('постановление государственной думы')) return 'Государственная Дума'
  if (t.startsWith('постановление совета федерации')) return 'Совет Федерации'
  if (t.startsWith('кодекс')) return 'Кодекс'
  if (/(^|\s)конституционн[а-яё]+\s+суд/.test(t)) return 'Конституционный Суд'
  if (t.startsWith('приказ')) return 'Ведомственный приказ'
  if (t.startsWith('распоряжение')) return 'Ведомственное распоряжение'
  if (t.startsWith('постановление')) return 'Постановление'
  if (t.startsWith('решение') || t.startsWith('определение') || t.startsWith('заключение')) {
    return 'Акт суда'
  }
  if (/^(соглашение|протокол|договор|конвенция|меморандум|поправки|исполнительный)/.test(t)) {
    return 'Международный документ'
  }
  return 'Другой акт'
}

const INTERNATIONAL_KEYWORD =
  /^(?:Исполнительный\s+протокол|Соглашение|Протокол|Договор|Конвенция|Меморандум|Поправки)(?![А-Яа-яЁёA-Za-z0-9])/i

/**
 * Заголовок акта приходит одной строкой. Поддерживаются два формата:
 *   1) «<тип> от ДД.ММ.ГГГГ № <номер> "<название>"» — основной;
 *   2) «<тип> от 15 марта 2016 года (…)» — международные документы, даты словами.
 */
function parseTitle(rawTitle) {
  const title = collapse(rawTitle)

  let match = title.match(/^(.*?)\s+от\s+(\d{2}\.\d{2}\.\d{4})\s*(.*)$/)
  if (match) {
    const [, type, date, rest] = match
    const { number, name } = splitNumberAndName(rest)
    return { type: type.trim(), number, date, name }
  }

  match = title.match(/^(.*?)\s+от\s+\d{1,2}\s+[а-яё]+\s+\d{4}\s*(?:года|г\.)?\s*(.*)$/i)
  if (match) {
    const [, head, rest] = match
    const keyword = head.match(INTERNATIONAL_KEYWORD)
    if (keyword) {
      // У международных документов предмет договора стоит до даты:
      // «Соглашение между … о воздушном сообщении от 15 марта 2016 года (…)».
      const subject = head.slice(keyword[0].length).trim()
      return {
        type: keyword[0].trim(),
        number: null,
        date: null,
        name: cleanName(`${subject} ${rest}`),
      }
    }
    return { type: head.trim(), number: null, date: null, name: cleanName(rest) }
  }

  return { type: null, number: null, date: null, name: '' }
}

const DDMMYYYY = /(\d{2})\.(\d{2})\.(\d{4})/

function normalizeDate(value) {
  if (!value) return null
  const match = value.match(DDMMYYYY)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

function toIsoDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function parseItems(xml, blockId) {
  const items = []
  for (const raw of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = raw[1]

    const title = tag(body, 'title')
    const link = tag(body, 'link')
    if (!title || !link) continue

    const description = tag(body, 'description') || ''
    const pubDate = tag(body, 'pubDate')

    // Дата публикации из description — самая надёжная: всегда ДД.ММ.ГГГГ.
    // Внимание: в ленте именно «Дата опубликования», без пропущенных букв.
    const published = description.match(/Дата опубликования:\s*(\d{2}\.\d{2}\.\d{4})/)
    const parsed = parseTitle(title)

    const date = normalizeDate(published?.[1]) || normalizeDate(parsed.date) || toIsoDate(pubDate)
    if (!date) {
      console.warn(`  пропущен акт без даты: ${title.slice(0, 80)}`)
      continue
    }

    const id = link.split('/').filter(Boolean).pop()
    if (!id) continue

    items.push({
      id,
      type: parsed.type || 'Правовой акт',
      number: parsed.number,
      date,
      // Если разобрать заголовок не удалось, показываем его целиком.
      name: parsed.name || title,
      url: link,
      category: guessCategory(parsed.type),
      sources: [blockId],
    })
  }

  return items
}

/* ------------------------------------------------------------------ */
/* Сборка                                                               */
/* ------------------------------------------------------------------ */

const daysAgo = (n) => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10)

async function loadBlock(block) {
  const blockParam = block.id ? `block=${block.id}&` : ''
  const url = `${FEED_BASE}?${blockParam}pageSize=${PAGE_SIZE}`
  console.log(`→ ${block.id || '(все акты)'} (${block.label})`)
  const items = parseItems(await fetchWithRetry(url), block.id)
  const latest = items.reduce((max, item) => (item.date > max ? item.date : max), '')
  console.log(`  получено ${items.length}, свежайшая дата ${latest || '—'}`)
  return { block, items, latest }
}

async function main() {
  const targets = [...FEDERAL_BLOCKS, ALL_BLOCK]
  const federalIds = new Set(FEDERAL_BLOCKS.map((b) => b.id))

  const byId = new Map()
  const failed = []
  const sections = []
  let federalOk = 0

  // Запросы строго последовательные: параллельные запросы к порталу
  // возвращают HTTP 500.
  for (const block of targets) {
    try {
      const { items, latest } = await loadBlock(block)
      if (federalIds.has(block.id)) federalOk += 1

      sections.push({ id: block.id, label: block.label, count: items.length, latest })

      for (const item of items) {
        const existing = byId.get(item.id)
        if (existing) {
          if (!existing.sources.includes(block.id)) existing.sources.push(block.id)
        } else {
          byId.set(item.id, item)
        }
      }
    } catch (error) {
      failed.push(`${block.id || 'все акты'} (${block.label}): ${error.message}`)
    }
    await sleep(GAP_MS)
  }

  if (failed.length) {
    console.warn(`\nПредупреждение: не удалось получить блоков — ${failed.length} из ${targets.length}`)
    for (const reason of failed) console.warn(`  - ${reason}`)
  }

  if (federalOk === 0) {
    console.error('\nНи один федеральный блок не получен — данные не обновляю.')
    console.error('Вероятная причина: раннер не может достучаться до publication.pravo.gov.ru по HTTP.')
    process.exit(1)
  }

  const cutoff = daysAgo(RANGE_DAYS)
  const items = [...byId.values()]
    .filter((item) => item.date >= cutoff)
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)))
    .map(({ sources, ...rest }) => ({
      ...rest,
      level: sources.some((s) => federalIds.has(s)) ? 'federal' : 'other',
    }))

  // Разделы, у которых на портале нет свежих актов. Показываем это в интерфейсе,
  // чтобы было видно: данные не пропали, а источник не обновляется.
  const stale = sections
    .filter((s) => s.id && (!s.latest || s.latest < cutoff))
    .map((s) => ({ id: s.id, label: s.label, latest: s.latest }))

  if (stale.length) {
    console.warn('\nВнимание: на источнике нет актов за период — эти разделы покажут пустоту:')
    for (const s of stale) console.warn(`  - ${s.label}: свежайшая дата ${s.latest || 'нет данных'}`)
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'publication.pravo.gov.ru',
    sourceUrl: 'http://publication.pravo.gov.ru/',
    rangeDays: RANGE_DAYS,
    cutoff,
    counts: {
      total: items.length,
      federal: items.filter((i) => i.level === 'federal').length,
      other: items.filter((i) => i.level === 'other').length,
    },
    sections,
    staleSections: stale,
    items,
  }

  await mkdir(dirname(OUT_FILE), { recursive: true })
  // Без отступов: файл коммитится в репозиторий каждый час, размер важен.
  await writeFile(OUT_FILE, JSON.stringify(payload), 'utf8')

  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1)
  console.log(
    `\nГотово: ${payload.counts.total} актов с ${cutoff} ` +
      `(федеральных ${payload.counts.federal}, прочих ${payload.counts.other}), ${kb} КБ`,
  )
  console.log(`Файл: ${OUT_FILE}`)
}

main().catch((error) => {
  console.error('Необработанная ошибка:', error)
  process.exit(1)
})
