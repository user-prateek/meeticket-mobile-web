/** Coalesce concurrent identical requests (e.g. React StrictMode double-mount). */
const inFlight = new Map()

export function dedupeInFlight(key, factory) {
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = Promise.resolve().then(factory).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}
