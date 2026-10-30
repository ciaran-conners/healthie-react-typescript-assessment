import { useCallback, useEffect, useState } from 'react'
import type { Character, SearchCharacters } from '../types'

interface SettledSearch {
  query: string
  characters: Character[]
  error: string | null
}

/**
 * Debounced, cancellable search over the injected `searchCharacters`.
 * "Loading" is derived (the last settled query isn't the current one), so stale
 * responses can never overwrite newer ones and there's no loading flag to keep in sync.
 */
export function useCharacterSearch(
  searchCharacters: SearchCharacters,
  query: string,
  enabled: boolean,
  debounceMs = 250,
) {
  const [settled, setSettled] = useState<SettledSearch | null>(null)
  const [attempt, setAttempt] = useState(0)
  const normalized = query.trim()

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchCharacters(normalized, controller.signal).then(
        (characters) => {
          if (!controller.signal.aborted) setSettled({ query: normalized, characters, error: null })
        },
        (error: unknown) => {
          if (controller.signal.aborted) return
          const message = error instanceof Error ? error.message : 'Search failed'
          setSettled({ query: normalized, characters: [], error: message })
        },
      )
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [searchCharacters, normalized, enabled, debounceMs, attempt])

  const current = settled?.query === normalized ? settled : null
  const retry = useCallback(() => {
    setSettled(null)
    setAttempt((n) => n + 1)
  }, [])

  return {
    // Keep showing the previous results while the next ones load, to avoid flicker.
    characters: current?.characters ?? settled?.characters ?? [],
    isLoading: enabled && current === null,
    error: current?.error ?? null,
    retry,
  }
}
