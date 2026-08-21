import { useEffect, useState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { fetchJourneyOptions, tripCacheKey } from '../api/journey'
import {
  journeyErrorAtom,
  journeyOptionsAtom,
  journeyRawAtom,
  journeyStatusAtom,
  journeyTripKeyAtom,
  selectedJourneyAtom,
  selectedJourneyIdAtom,
  tripAtom,
} from '../store/journey'

/**
 * Loads journey options for a trip into Jotai.
 * Reuses stored options when the trip key matches.
 */
export function useJourneyOptions(trip) {
  const {
    fromLat,
    fromLon,
    toLat,
    toLon,
    accessMode,
    egressMode,
    candidates,
    fromPlace,
    toPlace,
  } = trip || {}

  const key = trip ? tripCacheKey(trip) : ''
  const [storedKey, setStoredKey] = useAtom(journeyTripKeyAtom)
  const [options, setOptions] = useAtom(journeyOptionsAtom)
  const [status, setStatus] = useAtom(journeyStatusAtom)
  const [error, setError] = useAtom(journeyErrorAtom)
  const setRaw = useSetAtom(journeyRawAtom)
  const setTrip = useSetAtom(tripAtom)
  const [nonce, setNonce] = useState(0)

  const cacheHit = Boolean(trip) && nonce === 0 && storedKey === key && status === 'ready'

  useEffect(() => {
    if (!trip) {
      setStatus('idle')
      return undefined
    }
    if (cacheHit) return undefined

    const controller = new AbortController()
    setTrip(trip)
    setStatus('loading')
    setError('')
    setStoredKey(key)

    fetchJourneyOptions(
      {
        fromLat,
        fromLon,
        toLat,
        toLon,
        accessMode,
        egressMode,
        candidates,
        fromPlace,
        toPlace,
      },
      { signal: controller.signal },
    )
      .then(({ data, options: next }) => {
        setRaw(data)
        setOptions(next)
        setStatus('ready')
        setError('')
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRaw([])
        setOptions([])
        setStatus('error')
        setError(err.message || 'Could not load journey options')
      })

    return () => controller.abort()
  }, [
    key,
    nonce,
    cacheHit,
    trip,
    fromLat,
    fromLon,
    toLat,
    toLon,
    accessMode,
    egressMode,
    candidates,
    fromPlace,
    toPlace,
    setError,
    setOptions,
    setRaw,
    setStatus,
    setStoredKey,
    setTrip,
  ])

  function reload() {
    setNonce((n) => n + 1)
  }

  if (!trip) {
    return { options: [], status: 'idle', error: '', reload }
  }

  return {
    options: storedKey === key ? options : [],
    status: storedKey === key ? status : 'loading',
    error: storedKey === key ? error : '',
    reload,
  }
}

export function useSelectedJourney() {
  return useAtom(selectedJourneyAtom)
}

export function useJourneyOptionById(optionId) {
  const [options] = useAtom(journeyOptionsAtom)
  const id = Number(optionId)
  if (!Number.isFinite(id)) return undefined
  return options.find((option) => option.id === id)
}

export function useSelectJourney() {
  const setId = useSetAtom(selectedJourneyIdAtom)
  return (option) => setId(option?.id ?? null)
}
