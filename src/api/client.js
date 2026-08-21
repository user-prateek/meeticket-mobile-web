function headers() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

function toQuery(payload = {}) {
  return Object.entries(payload)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

/**
 * GET — `url` should already end with `?` (see urls in config).
 * `payload` object becomes query params.
 */
export async function GetRequest(url, payload = {}, { signal } = {}) {
  const response = await fetch(url + toQuery(payload), {
    method: 'GET',
    headers: headers(),
    signal,
  })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response.json()
}

/**
 * POST — sends `payload` as JSON body.
 */
export async function PostRequest(url, payload = {}, { signal } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
    signal,
  })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response.json()
}
