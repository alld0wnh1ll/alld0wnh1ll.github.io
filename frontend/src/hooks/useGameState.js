import { useState, useEffect } from 'react'
import { useIndexerAPI } from './useIndexerAPI'

export function useGameState() {
  const { data: leaderboardData } = useIndexerAPI('/api/game/leaderboard')
  const { data: stateData } = useIndexerAPI('/api/game/state')

  return {
    leaderboard: leaderboardData || { addresses: [], balances: [] },
    gameState: stateData || { lastIndexedBlock: 0 },
    loading: false,
  }
}
