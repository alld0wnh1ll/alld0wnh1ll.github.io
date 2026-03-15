import { useState, useEffect, useCallback } from 'react'

/**
 * Placeholder for Lemon Market player addresses.
 * Will fetch from GameManager when Lemon Market is deployed.
 */
export function useContractPlayers(config) {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPlayers = useCallback(async () => {
    if (!config?.gameManager) {
      setAddresses([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      // TODO: fetch from Lemon Market GameManager when deployed
      setAddresses([])
    } catch (e) {
      setError(e.message || 'Contract read failed')
      setAddresses([])
    } finally {
      setLoading(false)
    }
  }, [config?.gameManager])

  useEffect(() => {
    fetchPlayers()
  }, [fetchPlayers])

  return { addresses, loading, error, refetch: fetchPlayers }
}
