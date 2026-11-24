import { fetchMockLiveBuses } from './mockApi'

/** Buses drawn on the journey map. Mocked until a live position API is supplied. */
export function fetchLiveBuses({ signal } = {}) {
  return fetchMockLiveBuses({ signal })
}
