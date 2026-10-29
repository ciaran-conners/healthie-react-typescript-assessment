interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

/**
 * Minimal typed GraphQL-over-fetch client. GraphQL typically reports errors with a 200 status
 * and an `errors` array, so both transport and GraphQL errors become throws.
 */
export async function gql<T>(
  url: string,
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
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
