import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { fetchVehicleStops, readBusTicketQuery } from './api'
import { pickBoardingStop } from './boardingStop'
import { BookBar, BusTicketHeader } from './BusTicketChrome'
import { categoryLabel, routeCode, routeEnds, stopTitle } from './format'
import { BusArt, NamePencil, PencilIcon, PinIcon } from './icons'
import { patchBusTicketDraft, saveBusTicketDraft } from './session'
import './BusTicket.css'

function Radio({ selected, onLight }) {
  return <span className={`bt-radio${selected ? ' is-on' : ''}${onLight ? ' is-light' : ''}`} />
}

function StopList({ title, hint, stops, selectedId, onSelect, selectedOnGreen = false }) {
  return (
    <section className="bt-panel">
      <h2 className="bt-panel__title">{title}</h2>
      {hint ? <p className="bt-panel__hint">{hint}</p> : null}
      <div className="bt-stop-list" role="listbox">
        {stops.map((stop) => {
          const selected = stop.stop_id === selectedId
          const green = selected && selectedOnGreen
          return (
            <button
              key={`${stop.stop_sequence}-${stop.stop_id}`}
              type="button"
              role="option"
              aria-selected={selected}
              className={`bt-stop${green ? ' is-selected' : ''}`}
              onClick={() => onSelect(stop)}
            >
              <Radio selected={selected} onLight={green} />
              <span>{stopTitle(stop)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function BusTicketStopsPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const query = useMemo(() => readBusTicketQuery(params), [params])
  const [trip, setTrip] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState(null)
  const [destination, setDestination] = useState(null)
  const [panel, setPanel] = useState('dest')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchVehicleStops(query.vehicleId, { signal: controller.signal })
      .then((next) => {
        const boarding = pickBoardingStop(next.stops, query.lat, query.lng)
        setTrip(next)
        setSource(boarding)
        setDestination(null)
        setPanel('dest')
        saveBusTicketDraft({
          vehicleId: next.vehicleId,
          tripId: next.tripId,
          chaloRouteId: next.chaloRouteId,
          routeName: next.routeName,
          serviceCategory: next.serviceCategory,
          stops: next.stops,
          source: boarding,
          destination: null,
          lat: query.lat,
          lng: query.lng,
          seats: 1,
        })
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError(err?.message || 'Could not load bus stops')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [query.vehicleId, query.lat, query.lng])

  const ends = routeEnds(trip?.stops || [])
  const sourceOptions = (trip?.stops || []).slice(0, -1)
  const destinationOptions = (trip?.stops || []).filter(
    (stop) => source && Number(stop.stop_sequence) > Number(source.stop_sequence),
  )

  function chooseSource(stop) {
    setSource(stop)
    if (destination && Number(destination.stop_sequence) <= Number(stop.stop_sequence)) {
      setDestination(null)
      setPanel('dest')
    }
    patchBusTicketDraft({ source: stop, destination: destination && Number(destination.stop_sequence) > Number(stop.stop_sequence) ? destination : null })
  }

  function chooseDestination(stop) {
    setDestination(stop)
    setPanel('done')
    patchBusTicketDraft({ source, destination: stop })
  }

  function goSummary() {
    if (!source || !destination) return
    patchBusTicketDraft({ source, destination, seats: 1 })
    navigate('/bus/summary')
  }

  function onBack() {
    if (panel === 'source') {
      setPanel(destination ? 'done' : 'dest')
      return
    }
    if (panel === 'dest' && destination) {
      setPanel('done')
      return
    }
    navigate(-1)
  }

  const code = routeCode(trip?.routeName)
  const category = categoryLabel(trip?.serviceCategory)

  return (
    <section className="bt-page">
      <BusTicketHeader variant={panel === 'done' ? 'menu' : 'back'} onBack={onBack} />
      <div className="bt-scroll">
        {loading ? <p className="bt-status">Loading stops…</p> : null}
        {error ? <p className="bt-status bt-status--error">{error}</p> : null}

        {trip && source ? (
          <article className="bt-card">
            <div className="bt-you">
              <div>
                <p className="bt-you__label">You are in</p>
                <p className="bt-you__name">
                  <strong>{code}</strong> {category}
                  <NamePencil />
                </p>
              </div>
              <BusArt />
            </div>
            <div className="bt-place">
              <PinIcon />
              <div>
                <p className="bt-place__label">Source Stop</p>
                <p className="bt-place__name">{stopTitle(source)}</p>
              </div>
              <button type="button" className="bt-edit" aria-label="Change source stop" onClick={() => setPanel('source')}>
                <PencilIcon />
              </button>
            </div>
          </article>
        ) : null}

        {trip && panel === 'source' ? (
          <StopList
            title="Select Source Stop"
            stops={sourceOptions}
            selectedId={source?.stop_id}
            selectedOnGreen
            onSelect={chooseSource}
          />
        ) : null}

        {trip && panel !== 'done' ? (
          <section className="bt-panel">
            <h2 className="bt-panel__title">Select Destination Stop</h2>
            <div className="bt-direction">
              {ends.from} <span aria-hidden="true">→</span> {ends.to}
            </div>
            <p className="bt-panel__hint">Stations towards {ends.to}</p>
            <div className="bt-stop-list" role="listbox" aria-label="Destination stops">
              {destinationOptions.map((stop) => (
                <button
                  key={`${stop.stop_sequence}-${stop.stop_id}`}
                  type="button"
                  role="option"
                  className="bt-stop"
                  onClick={() => chooseDestination(stop)}
                >
                  <Radio />
                  <span>{stopTitle(stop)}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {trip && panel === 'done' && destination ? (
          <article className="bt-card bt-card--place">
            <div className="bt-place">
              <PinIcon />
              <div>
                <p className="bt-place__label">Destination Stop</p>
                <p className="bt-place__name">{stopTitle(destination)}</p>
              </div>
              <button type="button" className="bt-edit" aria-label="Change destination stop" onClick={() => setPanel('dest')}>
                <PencilIcon />
              </button>
            </div>
          </article>
        ) : null}
      </div>
      <BookBar label="BOOK BUS TICKET" disabled={!source || !destination} onClick={goSummary} />
    </section>
  )
}
