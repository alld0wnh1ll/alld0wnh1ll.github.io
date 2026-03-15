import { useState, useEffect } from 'react'

/**
 * Lemon Market config loader.
 * Fetches lemon-config.json when deployed; returns null until then.
 */
export function useGameConfig() {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    fetch('/lemon-config.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])
  return config
}

/**
 * Placeholder for Lemon Market contract access.
 * Will be implemented when Lemon Market contracts are deployed.
 */
export function useGameContract(name, config) {
  return null
}
