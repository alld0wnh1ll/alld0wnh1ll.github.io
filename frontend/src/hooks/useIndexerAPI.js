import { useState, useEffect, useCallback } from 'react'

// Indexer runs on port 3001. Use same host as page (works for localhost and IP access).
function getIndexerBaseUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3001'
  return `http://${window.location.hostname}:3001`
}

export function useIndexerAPI(path) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!path) return
    setLoading(true)
    setError(null)
    const pathStr = path.startsWith('/') ? path : `/${path}`
    const directUrl = `${getIndexerBaseUrl()}${pathStr}`
    const proxyUrl = pathStr // Vite proxies /api to localhost:3001
    const urlsToTry = [directUrl, proxyUrl]
    const maxRetries = 2
    let lastError = null
    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        for (const url of urlsToTry) {
          try {
            const res = await fetch(url, { cache: 'no-store', mode: 'cors' })
            if (!res.ok) throw new Error(res.statusText)
            const json = await res.json()
            setData(json)
            return
          } catch (e) {
            lastError = e
          }
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
      setError(lastError?.message || 'Indexer unreachable')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
