import { useCallback, useEffect, useMemo, useState } from 'react'
import ActCard from './components/ActCard.jsx'
import Freshness from './components/Freshness.jsx'
import Toolbar from './components/Toolbar.jsx'
import {
  formatDate,
  loadActs,
  loadFavorites,
  loadPrefs,
  normalizeFavorites,
  saveFavorites,
  savePrefs,
  selectActs,
  selectFavorites,
  today,
} from './lib/acts.js'

const DEFAULT_PREFS = { range: '7', showOther: false, query: '', onlyFavorites: false }

export default function App() {
  const [payload, setPayload] = useState(null)
  const [status, setStatus] = useState('loading')
  const [fromCache, setFromCache] = useState(false)
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [storedFavorites, setStoredFavorites] = useState([])

  // Настройки и избранное живут только в браузере.
  useEffect(() => {
    setPrefs({ ...DEFAULT_PREFS, ...loadPrefs() })
    setStoredFavorites(loadFavorites())
  }, [])

  const refresh = useCallback(async () => {
    setStatus('loading')
    try {
      const result = await loadActs()
      setPayload(result.payload)
      setFromCache(Boolean(result.fromCache))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const changePrefs = useCallback((patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })
  }, [])

  const items = payload?.items ?? []

  // Хранится снимок акта, а не только его id: id существует лишь внутри
  // текущего acts.json, и акт, вытесненный лимитом 200 или окном в 60 дней,
  // иначе было бы уже нечего показать.
  const favorites = useMemo(() => normalizeFavorites(storedFavorites, items), [storedFavorites, items])

  // toggleFavorite читает favorites из замыкания, поэтому зависит от него.
  const toggleFavorite = useCallback(
    (act) => {
      const next = favorites.some((value) => value.id === act.id)
        ? favorites.filter((value) => value.id !== act.id)
        : [act, ...favorites]
      setStoredFavorites(next)
      saveFavorites(next)
    },
    [favorites],
  )

  const reset = useCallback(() => {
    setPrefs((prev) => {
      savePrefs(DEFAULT_PREFS)
      return DEFAULT_PREFS
    })
  }, [])

  const visible = useMemo(
    () => (prefs.onlyFavorites ? selectFavorites(favorites, prefs) : selectActs(items, prefs)),
    [favorites, items, prefs],
  )

  // Группировка по дате: так список читается как хроника.
  const groups = useMemo(() => {
    const map = new Map()
    for (const act of visible) {
      if (!map.has(act.date)) map.set(act.date, [])
      map.get(act.date).push(act)
    }
    return [...map.entries()]
  }, [visible])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  const sourceUrl = payload?.sourceUrl || 'http://publication.pravo.gov.ru/'
  const stale = payload?.staleSections ?? []

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Обновления законодательства РФ</h1>
        <p className="page__subtitle">
          Последние акты, опубликованные на{' '}
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            официальном интернет-портале правовой информации
          </a>
          . Данные обновляются автоматически раз в час.
        </p>
      </header>

      <Freshness
        updatedAt={payload?.updatedAt}
        fromCache={fromCache}
        loading={status === 'loading'}
        onRefresh={refresh}
      />

      {status === 'error' && (
        <p className="notice notice--error">
          Не удалось загрузить данные. Проверьте, что отработал GitHub Actions
          (вкладка Actions → update.yml) и что в репозитории есть файл
          public/data/acts.json.
        </p>
      )}

      {status !== 'error' && (
        <>
          <Toolbar
            prefs={prefs}
            counts={{
              visible: visible.length,
              total: prefs.onlyFavorites ? favorites.length : items.length,
            }}
            favoriteCount={favorites.length}
            onChange={changePrefs}
            onReset={reset}
          />

          {stale.length > 0 && (
            <p className="notice notice--warn">
              {stale.length === 1
                ? 'На самом портале нет свежих актов в разделе'
                : 'На самом портале нет свежих актов в разделах'}{' '}
              {stale
                .map((section) =>
                  `«${section.label}» — ${section.latest ? `свежайшая от ${formatDate(section.latest)}` : 'данных нет'}`,
                )
                .join('; ')}
              . Это ограничение источника, а не сайта.
            </p>
          )}

          {visible.length === 0 ? (
            <p className="notice">
              {prefs.onlyFavorites
                ? favorites.length === 0
                  ? 'В избранном пока ничего нет. Нажмите на звезду у карточки, чтобы сохранить акт.'
                  : 'Ничего не найдено среди избранного. Попробуйте изменить запрос.'
                : 'Ничего не найдено. Попробуйте расширить период или изменить запрос.'}
              {!prefs.onlyFavorites && payload?.cutoff && ` Данные доступны с ${formatDate(payload.cutoff)}.`}
            </p>
          ) : (
            <main className="feed">
              {groups.map(([date, acts]) => (
                <section className="day" key={date}>
                  <h2 className={`day__title${date === today() ? ' day__title--today' : ''}`}>
                    {date === today() ? 'Сегодня' : formatDate(date)}
                    <span className="day__count">{acts.length}</span>
                  </h2>
                  <div className="day__cards">
                    {acts.map((act) => (
                      <ActCard
                        key={act.id}
                        act={act}
                        favorite={favoriteSet.has(act.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </main>
          )}

          <footer className="page__foot">
            {payload && (
              <p>
                В файле {payload.counts.total} актов с {formatDate(payload.cutoff)}:{' '}
                {payload.counts.federal} федеральных и {payload.counts.other} прочих. История
                ограничена {payload.rangeDays} днями и лимитом источника в 200 записей на раздел.
              </p>
            )}
            <p>
              Данные — официальный источник, сайт лишь агрегирует их.{' '}
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                publication.pravo.gov.ru
              </a>
            </p>
          </footer>
        </>
      )}
    </div>
  )
}
