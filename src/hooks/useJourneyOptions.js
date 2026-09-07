import { useEffect, useState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { fetchJourneyOptions, tripCacheKey } from '../api/journey'
import {
  journeyErrorAtom,
  journeyOptionsAtom,
  journeyRawAtom,
  journeyStatusAtom,
  selectedJourneyAtom,
  selectedJourneyIdAtom,
  selectedJourneySnapshotAtom,
  tripAtom,
} from '../store/journey'

/**
 * Loads journey options for a trip into Jotai.
 * Always refetches when the trip changes or the page reloads (no session cache).
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
  const [options, setOptions] = useAtom(journeyOptionsAtom)
  const [status, setStatus] = useAtom(journeyStatusAtom)
  const [error, setError] = useAtom(journeyErrorAtom)
  const setRaw = useSetAtom(journeyRawAtom)
  const setTrip = useSetAtom(tripAtom)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!trip) {
      setStatus('idle')
      setOptions([])
      setRaw([])
      setError('')
      return undefined
    }

    const controller = new AbortController()
    setTrip(trip)
    setStatus('loading')
    setError('')
    setOptions([])
    setRaw([])

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
      {
        signal: controller.signal,
        onPartial: ({ data, options: next }) => {
          setRaw(data)
          setOptions(next)
          if (next.length > 0) {
            setStatus('ready')
            setError('')
          }
        },
      },
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
    setTrip,
  ])

  function reload() {
    setNonce((n) => n + 1)
  }

  if (!trip) {
    return { options: [], status: 'idle', error: '', reload }
  }

  return { options, status, error, reload }
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
  const setSnapshot = useSetAtom(selectedJourneySnapshotAtom)
  return (option) => {
    setId(option?.id ?? null)
    setSnapshot(option || null)
  }
}
