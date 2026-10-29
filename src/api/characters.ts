import type { Character, SearchCharacters } from '../components/kanban/types'
import { gql } from './gql'

const SEARCH_CHARACTERS = /* GraphQL */ `
  query SearchCharacters($name: String) {
    characters(filter: { name: $name }) {
      results {
        id
        name
        image
        species
        status
      }
    }
  }
`

interface SearchCharactersData {
  characters: { results: Character[] | null } | null
}

// Only settled results are cached; in-flight requests aren't shared because
// each caller owns its AbortSignal.
const cache = new Map<string, Character[]>()

/** Adapter that satisfies the board's `SearchCharacters` contract using the Rick and Morty API. */
export const searchRickAndMorty: SearchCharacters = async (query, signal) => {
  const key = query.trim().toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const data = await gql<SearchCharactersData>(SEARCH_CHARACTERS, { name: key }, signal)
  const results = data.characters?.results ?? []
  cache.set(key, results)
  return results
}
