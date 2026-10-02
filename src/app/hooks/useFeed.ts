/**
 * Загрузка данных страницы: статус, payload, признак показа локальной копии.
 */

import { useCallback, useEffect, useState } from 'react'

import type { ActPayload } from '../../entities/act/model/types.ts'
import { loadActs } from '../../shared/api/actsApi.ts'

export type FeedStatus = 'loading' | 'ready' | 'error'

export interface FeedState {
  payload: ActPayload | null
  status: FeedStatus
  fromCache: boolean
  refresh: () => void
}

export function useFeed(): FeedState {
  const [payload, setPayload] = useState<ActPayload | null>(null)
  const [status, setStatus] = useState<FeedStatus>('loading')
  const [fromCache, setFromCache] = useState(false)

  const refresh = useCallback(() => {
    setStatus('loading')

    void (async () => {
      try {
        const result = await loadActs()
        setPayload(result.payload)
        setFromCache(result.fromCache)
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    })()
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { payload, status, fromCache, refresh }
}
