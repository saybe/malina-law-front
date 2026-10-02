import { useCallback, useMemo, useState } from 'react'

import { useFeed } from './hooks/useFeed.ts'
import type { Prefs } from '../entities/act/model/types.ts'
import { selectActs, selectFavorites } from '../entities/act/model/select.ts'
import { useFavorites } from '../features/favorites/model/useFavorites.ts'
import Toolbar from '../features/filters/ui/Toolbar.tsx'
import { groupByDate } from '../widgets/feed/model/groupByDate.ts'
import EmptyNotice from '../widgets/feed/ui/EmptyNotice.tsx'
import Feed from '../widgets/feed/ui/Feed.tsx'
import Freshness from '../widgets/feed/ui/Freshness.tsx'
import StaleNotice from '../widgets/feed/ui/StaleNotice.tsx'
import { formatDate } from '../shared/lib/date.ts'
import { DEFAULT_PREFS, loadPrefs, savePrefs } from '../shared/lib/storage.ts'

const DEFAULT_SOURCE_URL = 'http://publication.pravo.gov.ru/'

export default function App() {
  const { payload, status, fromCache, refresh } = useFeed()

  // Настройки живут только в браузере.
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())

  const changePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    savePrefs(DEFAULT_PREFS)
    setPrefs(DEFAULT_PREFS)
  }, [])

  const items = useMemo(() => payload?.items ?? [], [payload])
  const { favorites, isFavorite, toggleFavorite } = useFavorites(items)

  // В режиме избранного период и уровень не применяются: см. selectFavorites.
  const visible = useMemo(
    () => (prefs.onlyFavorites ? selectFavorites(favorites, prefs) : selectActs(items, prefs)),
    [favorites, items, prefs],
  )

  const groups = useMemo(() => groupByDate(visible), [visible])

  const sourceUrl = payload?.sourceUrl || DEFAULT_SOURCE_URL

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

      {status === 'error' ? (
        <p className="notice notice--error">
          Не удалось загрузить данные. Проверьте, что отработал GitHub Actions (вкладка Actions →
          update.yml) и что в репозитории есть файл public/data/acts.json.
        </p>
      ) : (
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

          <StaleNotice sections={payload?.staleSections ?? []} />

          {visible.length === 0 ? (
            <EmptyNotice
              onlyFavorites={prefs.onlyFavorites}
              favoritesCount={favorites.length}
              cutoff={payload?.cutoff}
            />
          ) : (
            <Feed groups={groups} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
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
