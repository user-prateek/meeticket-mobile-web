function headers(extra = {}) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra,
  }
}

function toQuery(payload = {}) {
  return Object.entries(payload)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

function readApiErrorMessage(data) {
  if (data == null) return null
  if (typeof data === 'string') {
    const text = data.trim()
    return text && text !== '[object Object]' ? text : null
  }
  if (typeof data !== 'object') return null

  const detail = data.detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const nested = detail.message || detail.error || detail.errorMessage
    if (typeof nested === 'string' && nested.trim()) return nested.trim()
  }
  if (Array.isArray(detail) && detail[0]) {
    const first = detail[0]
    const fromList =
      typeof first === 'string' ? first : first?.msg || first?.message || first?.error
    if (typeof fromList === 'string' && fromList.trim()) return fromList.trim()
  }

  const direct = data.error || data.errorMessage || data.message
  if (typeof direct === 'string' && direct.trim() && direct !== '[object Object]') {
    return direct.trim()
  }
  return null
}

/**
 * GET — `url` should already end with `?` (see urls in config).
 * `payload` object becomes query params.
 */
export async function GetRequest(url, payload = {}, { signal, headers: extraHeaders } = {}) {
  const response = await fetch(url + toQuery(payload), {
    method: 'GET',
    headers: headers(extraHeaders),
    signal,
  })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response.json()
}

/**
 * POST — sends `payload` as JSON body.
 * Pass `headers` for partner auth (e.g. Refex client-id / client-secret).
 *
 * MeeTicket Integration API: HTTP status is the outcome. Failure body shape:
 *   { response: null, error: "<message>", code: null }
 */
export async function PostRequest(
  url,
  payload = {},
  { signal, headers: extraHeaders, noBody = false } = {},
) {
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: noBody
        ? { Accept: 'application/json', ...extraHeaders }
        : headers(extraHeaders),
      body: noBody ? undefined : JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    const err = new Error(
      error?.message?.includes('Failed to fetch')
        ? 'Network error — check CORS or API availability'
        : error?.message || 'Network request failed',
    )
    err.cause = error
    throw err
  }

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const apiMessage = readApiErrorMessage(data)
    const validation =
      data && typeof data === 'object' && data.errors
        ? ` — ${JSON.stringify(data.errors)}`
        : ''
    const message =
      apiMessage ||
      text?.slice(0, 200) ||
      `Request failed (${response.status})`
    const err = new Error(`${message}${validation}`)
    err.status = response.status
    err.body = data
    throw err
  }

  return data
}
