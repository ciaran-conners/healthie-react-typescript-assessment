import type { Character, SearchCharacters } from '../../types'
import { gql } from './gql'

const RICK_AND_MORTY_GRAPHQL_URL = 'https://rickandmortyapi.com/graphql'

const SEARCH_CHARACTERS = /* GraphQL */ `
  query SearchCharacters($name: String) {
    characters(filter: { name: $name }) {
      results {
        id
        name
        image
        species
      }
    }
  }
`

interface SearchCharactersData {
  characters: { results: Character[] | null } | null
}

// Settled results only: in-flight requests aren't shared because each caller owns its AbortSignal.
const cache = new Map<string, Character[]>()

export const searchRickAndMorty: SearchCharacters = async (query, signal) => {
  const key = query.trim().toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const data = await gql<SearchCharactersData>(
    RICK_AND_MORTY_GRAPHQL_URL,
    SEARCH_CHARACTERS,
    { name: key },
    signal,
  )
  const results = data.characters?.results ?? []
  cache.set(key, results)
  return results
}
