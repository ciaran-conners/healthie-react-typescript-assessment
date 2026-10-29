export const RICK_AND_MORTY_GRAPHQL_URL = 'https://rickandmortyapi.com/graphql'

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

/**
 * Minimal typed GraphQL client. GraphQL usually reports errors with a 200 status
 * and an `errors` array, so both transport and GraphQL errors are turned into throws.
 */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
  url = RICK_AND_MORTY_GRAPHQL_URL,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal,
  })
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`)

  const json = (await res.json()) as GraphQLResponse<T>
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(', '))
  if (!json.data) throw new Error('Response contained no data')
  return json.data
}
